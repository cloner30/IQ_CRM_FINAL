"""Enterprise API routes: vendors, financial, status workflow, notifications."""

import uuid
import logging
import aiofiles
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict
from pymongo import UpdateOne

from permissions import (
    require_permission,
    require_submit_group,
    check_permission,
    is_system_role,
    is_vendor_role,
    can_access_group,
    normalize_role,
    VALID_ROLES,
)
from group_status import (
    GROUP_STATUSES,
    VALID_STATUS_TRANSITIONS,
    DEFAULT_STATUS,
    SUBMITTED_STATUS,
    VENDOR_ASSIGNED_STATUS,
    REASON_REQUIRED_FOR,
    get_status_definitions,
    normalize_status,
)
from group_id import generate_group_id, preview_group_id
from notifications import send_notification, render_template, notify_users_by_role
import accounting as acct_module
from visa_outcome import validate_visa_outcomes, derive_group_visa_status
from status_sync import (
    log_status_change,
    get_passenger_aggregate,
    validate_group_transition_aggregate,
    apply_group_status_to_passengers,
    reconcile_group_status,
)

logger = logging.getLogger(__name__)


class GroupStatusUpdate(BaseModel):
    new_status: str
    reason: Optional[str] = ""


class VisaOutcomeItem(BaseModel):
    passport_id: str
    visa_status: Literal["visa_issued", "visa_rejected"]


class CompleteVisaOutcomeRequest(BaseModel):
    outcomes: List[VisaOutcomeItem]
    reason: Optional[str] = ""


class GroupSplitRequest(BaseModel):
    batch_sizes: List[int]
    reason: Optional[str] = ""


class VendorCreate(BaseModel):
    name: str
    code: str
    contact: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    base_cost_per_passport: float = 0.0


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    base_cost_per_passport: Optional[float] = None
    status: Optional[str] = None


class Vendor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str
    contact: str = ""
    email: str = ""
    phone: str = ""
    base_cost_per_passport: float = 0.0
    status: str = "active"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AssignVendorRequest(BaseModel):
    vendor_id: str


class UnassignVendorRequest(BaseModel):
    reason: Optional[str] = ""


def register_enterprise_routes(api_router, db, get_current_user, verify_group_access, get_user_group_filter):
    """Register all enterprise endpoints on the main API router."""

    @api_router.get("/group-status-definitions")
    async def get_group_status_definitions(current_user: dict = Depends(get_current_user)):
        return get_status_definitions()

    # --- Group status ---
    @api_router.patch("/groups/{group_id}/status")
    async def update_group_status(
        group_id: str,
        status_data: GroupStatusUpdate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_update_group_status")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        old_status = normalize_status(group.get("status", DEFAULT_STATUS))
        new_status = status_data.new_status

        # Keep vendor assignment consistent:
        # If a vendor is still assigned, system users must unassign first
        # before moving the group back to Data Processing / Submitted for Process.
        assigned_vendor_id = group.get("assigned_vendor_id")
        if assigned_vendor_id and new_status in {DEFAULT_STATUS, SUBMITTED_STATUS}:
            raise HTTPException(
                status_code=400,
                detail="Please unassign the vendor before moving the group back",
            )

        if new_status not in GROUP_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use: {GROUP_STATUSES}")
        if new_status in REASON_REQUIRED_FOR and not (status_data.reason or "").strip():
            raise HTTPException(status_code=400, detail=f"Reason is required for status {new_status}")
        allowed = VALID_STATUS_TRANSITIONS.get(old_status, [])
        if new_status != old_status and new_status not in allowed:
            raise HTTPException(status_code=400, detail=f"Cannot transition from {old_status} to {new_status}")

        if old_status == "VISA_IN_PROCESS" and new_status in {"VISA_ISSUED", "VISA_REJECTED"}:
            raise HTTPException(
                status_code=400,
                detail="Use POST /groups/{group_id}/complete-visa-outcome to record passenger visa outcomes",
            )

        agg = await get_passenger_aggregate(db, group_id)
        validate_group_transition_aggregate(
            old_status, new_status, agg, bool(assigned_vendor_id)
        )

        await db.groups.update_one({"id": group_id}, {"$set": {"status": new_status}})
        await log_status_change(
            db, group_id, old_status, new_status, current_user["id"], status_data.reason or ""
        )
        await apply_group_status_to_passengers(db, group_id, old_status, new_status)

        if new_status == SUBMITTED_STATUS:
            group = await db.groups.find_one({"id": group_id}, {"_id": 0})
            client = await db.clients.find_one({"id": group.get("client_id")}) or {}
            passport_count = await db.passports.count_documents({"group_id": group_id})
            passenger_count = group.get("passenger_count") or passport_count or 0
            suggested = acct_module.compute_suggested_revenue(passenger_count, group, client)
            await notify_users_by_role(
                db, ["client_admin", "client_accounts", "system_admin", "system_accounts"],
                "group_submitted",
                {
                    "group_id": group_id,
                    "passenger_count": passenger_count,
                    "amount": f"{suggested:.2f}",
                    "due_date": "Record client receipt",
                },
                group_id,
            )

        notif_map = {
            "VISA_IN_PROCESS": "visa_submitted",
            "VISA_ISSUED": "visa_approved",
            "VISA_REJECTED": "visa_rejected",
        }
        if new_status in notif_map:
            ctx = {"group_id": group_id, "rejection_reason": status_data.reason or "See group details"}
            title, body = render_template(notif_map[new_status], ctx)
            await notify_users_by_role(
                db, ["client_admin", "system_admin", "system_staff"],
                notif_map[new_status], ctx, group_id,
            )

        updated = await db.groups.find_one({"id": group_id}, {"_id": 0})
        return updated

    @api_router.post("/groups/{group_id}/complete-visa-outcome")
    async def complete_visa_outcome(
        group_id: str,
        body: CompleteVisaOutcomeRequest,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_update_group_status")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        old_status = normalize_status(group.get("status", DEFAULT_STATUS))
        if old_status != "VISA_IN_PROCESS":
            raise HTTPException(
                status_code=400,
                detail=f"Visa outcomes can only be completed from VISA_IN_PROCESS (current: {old_status})",
            )

        passports = await db.passports.find({"group_id": group_id}, {"_id": 0, "id": 1}).to_list(10000)
        passport_ids = [p["id"] for p in passports]
        issued_count, rejected_count = validate_visa_outcomes(passport_ids, body.outcomes)

        if rejected_count > 0 and not (body.reason or "").strip():
            raise HTTPException(status_code=400, detail="Reason is required when any passenger is visa rejected")

        new_status = derive_group_visa_status(rejected_count)
        now = datetime.now(timezone.utc).isoformat()
        reason = (body.reason or "").strip()

        bulk_ops = [
            UpdateOne(
                {"id": item.passport_id, "group_id": group_id},
                {"$set": {
                    "visa_status": item.visa_status,
                    "visa_status_updated_at": now,
                    "status": "done",
                    "status_updated_at": now,
                }},
            )
            for item in body.outcomes
        ]
        if bulk_ops:
            await db.passports.bulk_write(bulk_ops)

        await db.groups.update_one({"id": group_id}, {"$set": {"status": new_status}})
        await log_status_change(db, group_id, old_status, new_status, current_user["id"], reason)

        notif_type = "visa_rejected" if rejected_count > 0 else "visa_approved"
        ctx = {
            "group_id": group_id,
            "rejection_reason": reason or "See group details",
            "issued_count": issued_count,
            "rejected_count": rejected_count,
        }
        await notify_users_by_role(
            db, ["client_admin", "system_admin", "system_staff"],
            notif_type, ctx, group_id,
        )

        updated_group = await db.groups.find_one({"id": group_id}, {"_id": 0})
        updated_passports = await db.passports.find({"group_id": group_id}, {"_id": 0}).to_list(10000)
        return {
            "group": updated_group,
            "updated_passports": updated_passports,
            "summary": {"issued": issued_count, "rejected": rejected_count},
        }

    @api_router.post("/groups/{group_id}/sync-from-passengers")
    async def sync_from_passengers(
        group_id: str,
        current_user: dict = Depends(get_current_user),
    ):
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        new_status = await reconcile_group_status(
            db, group_id, user_id=current_user["id"]
        )
        updated = await db.groups.find_one({"id": group_id}, {"_id": 0})
        agg = await get_passenger_aggregate(db, group_id)
        return {
            "group": updated,
            "status": new_status or normalize_status(group.get("status", DEFAULT_STATUS)),
            "passenger_summary": agg,
        }

    @api_router.post("/groups/{group_id}/submit")
    async def submit_group(group_id: str, current_user: dict = Depends(get_current_user)):
        require_submit_group(current_user)
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        old_status = normalize_status(group.get("status", DEFAULT_STATUS))
        if old_status != DEFAULT_STATUS:
            raise HTTPException(
                status_code=400,
                detail=f"Group can only be submitted from {DEFAULT_STATUS} (current: {old_status})",
            )

        passport_count = await db.passports.count_documents({"group_id": group_id})
        if passport_count < 1:
            raise HTTPException(status_code=400, detail="Add at least one passport before submitting")

        new_status = SUBMITTED_STATUS
        await db.groups.update_one({"id": group_id}, {"$set": {"status": new_status}})
        await log_status_change(
            db, group_id, old_status, new_status, current_user["id"], "Group submitted by client"
        )

        group = await db.groups.find_one({"id": group_id}, {"_id": 0})
        client = await db.clients.find_one({"id": group.get("client_id")}) or {}
        passenger_count = group.get("passenger_count") or passport_count or 0
        suggested = acct_module.compute_suggested_revenue(passenger_count, group, client)
        await notify_users_by_role(
            db, ["client_admin", "client_accounts", "system_admin", "system_accounts"],
            "group_submitted",
            {
                "group_id": group_id,
                "passenger_count": passenger_count,
                "amount": f"{suggested:.2f}",
                "due_date": "Record client receipt",
            },
            group_id,
        )

        return await db.groups.find_one({"id": group_id}, {"_id": 0})

    @api_router.get("/groups/{group_id}/status-history")
    async def get_status_history(group_id: str, current_user: dict = Depends(get_current_user)):
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        history = await db.status_history.find({"group_id": group_id}, {"_id": 0}).sort("timestamp", -1).to_list(500)
        for entry in history:
            user = await db.users.find_one({"id": entry.get("changed_by_user_id")}, {"_id": 0, "name": 1})
            entry["changed_by_name"] = user["name"] if user else "Unknown"
        return history

    @api_router.post("/groups/{group_id}/split")
    async def split_group(
        group_id: str,
        split_data: GroupSplitRequest,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_split_groups")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")

        passports = await db.passports.find({"group_id": group_id}).to_list(10000)
        if sum(split_data.batch_sizes) != len(passports):
            raise HTTPException(status_code=400, detail="Batch sizes must sum to passenger count")

        new_groups = []
        idx = 0
        for i, size in enumerate(split_data.batch_sizes):
            batch = passports[idx:idx + size]
            idx += size
            if not batch:
                continue
            departure = group.get("departure_date")
            new_id = await generate_group_id(db, departure) if departure else str(uuid.uuid4())
            new_group = {
                **{k: v for k, v in group.items() if k != "_id"},
                "id": new_id,
                "name": f"{group['name']} - Batch {i + 1}",
                "split_from_group_id": group_id,
                "passport_count": len(batch),
                "status": normalize_status(group.get("status", DEFAULT_STATUS)),
                "is_archived": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.groups.insert_one(new_group)
            for p in batch:
                await db.passports.update_one({"id": p["id"]}, {"$set": {"group_id": new_id}})
            new_groups.append(new_group)

        parent_status = normalize_status(group.get("status", DEFAULT_STATUS))
        await db.groups.update_one({"id": group_id}, {"$set": {"is_archived": True}})
        await log_status_change(
            db,
            group_id,
            parent_status,
            parent_status,
            current_user["id"],
            split_data.reason or "Group split (archived)",
            action="split",
        )

        title, body = render_template("group_split", {"group_id": group_id, "count": len(new_groups)})
        await notify_users_by_role(db, ["client_admin", "system_admin"], "group_split", {"group_id": group_id, "count": len(new_groups)}, group_id)

        return {"original_group_id": group_id, "new_groups": new_groups}

    # --- Vendors ---
    @api_router.post("/vendors", response_model=Vendor)
    async def create_vendor(vendor_data: VendorCreate, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_manage_vendors")
        existing = await db.vendors.find_one({"code": vendor_data.code})
        if existing:
            raise HTTPException(status_code=400, detail="Vendor code already exists")
        vendor = Vendor(**vendor_data.model_dump())
        doc = vendor.model_dump()
        await db.vendors.insert_one(doc)
        return vendor

    @api_router.get("/vendors", response_model=List[Vendor])
    async def list_vendors(current_user: dict = Depends(get_current_user)):
        role = normalize_role(current_user.get("role"))
        if role not in ("system_admin", "system_staff"):
            if is_vendor_role(current_user):
                vendor = await db.vendors.find_one({"id": current_user.get("vendor_id")}, {"_id": 0})
                return [vendor] if vendor else []
            raise HTTPException(status_code=403, detail="Access denied")
        vendors = await db.vendors.find({}, {"_id": 0}).to_list(1000)
        return vendors

    @api_router.get("/vendors/{vendor_id}", response_model=Vendor)
    async def get_vendor(vendor_id: str, current_user: dict = Depends(get_current_user)):
        vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        if is_vendor_role(current_user) and current_user.get("vendor_id") != vendor_id:
            raise HTTPException(status_code=403, detail="Access denied")
        return vendor

    @api_router.put("/vendors/{vendor_id}", response_model=Vendor)
    async def update_vendor(vendor_id: str, vendor_data: VendorUpdate, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_manage_vendors")
        update = {k: v for k, v in vendor_data.model_dump().items() if v is not None}
        if not update:
            raise HTTPException(status_code=400, detail="No data to update")
        result = await db.vendors.update_one({"id": vendor_id}, {"$set": update})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return await db.vendors.find_one({"id": vendor_id}, {"_id": 0})

    @api_router.post("/groups/{group_id}/assign-vendor")
    async def assign_vendor(
        group_id: str,
        body: AssignVendorRequest,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_assign_vendor")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        vendor = await db.vendors.find_one({"id": body.vendor_id})
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")

        old_status = normalize_status(group.get("status", DEFAULT_STATUS))
        if old_status != SUBMITTED_STATUS:
            raise HTTPException(
                status_code=400,
                detail=f"Vendor can only be assigned when status is {SUBMITTED_STATUS} (current: {old_status})",
            )

        await db.groups.update_one(
            {"id": group_id},
            {"$set": {
                "assigned_vendor_id": body.vendor_id,
                "status": VENDOR_ASSIGNED_STATUS,
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await log_status_change(
            db, group_id, old_status, VENDOR_ASSIGNED_STATUS, current_user["id"],
            f"Assigned to {vendor['name']}",
        )
        await reconcile_group_status(db, group_id, user_id=current_user["id"])

        passport_count = await db.passports.count_documents({"group_id": group_id})
        unit_cost = vendor.get("base_cost_per_passport", 0)
        await acct_module.create_payable_for_vendor_assignment(
            db,
            vendor_id=body.vendor_id,
            group_id=group_id,
            unit_cost=unit_cost,
            quantity=passport_count,
            created_by_user_id=current_user["id"],
        )

        vendor_users = await db.users.find({"vendor_id": body.vendor_id, "status": {"$ne": "inactive"}}).to_list(100)
        client = await db.clients.find_one({"id": group.get("client_id")}) or {}
        for vu in vendor_users:
            title, body_text = render_template("vendor_assigned", {
                "group_id": group_id,
                "client": client.get("name", "Unknown"),
                "passenger_count": passport_count,
                "deadline": group.get("departure_date", "TBD"),
            })
            await send_notification(db, vu["id"], "vendor_assigned", title, body_text, group_id)

        return {"status": "success", "group_id": group_id, "vendor_id": body.vendor_id}

    @api_router.post("/groups/{group_id}/unassign-vendor")
    async def unassign_vendor(
        group_id: str,
        body: UnassignVendorRequest,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_assign_vendor")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")
        if not group.get("assigned_vendor_id"):
            raise HTTPException(status_code=400, detail="No vendor is assigned to this group")

        old_status = normalize_status(group.get("status", DEFAULT_STATUS))
        # Allow unassign even if the group has inconsistent status,
        # as long as `assigned_vendor_id` is present.

        vendor = await db.vendors.find_one({"id": group["assigned_vendor_id"]})
        vendor_name = vendor.get("name", "Unknown") if vendor else "Unknown"

        await db.groups.update_one(
            {"id": group_id},
            {
                "$set": {"status": SUBMITTED_STATUS},
                "$unset": {"assigned_vendor_id": "", "assigned_at": ""},
            },
        )
        await log_status_change(
            db,
            group_id,
            old_status,
            SUBMITTED_STATUS,
            current_user["id"],
            body.reason or f"Unassigned vendor {vendor_name}",
            action="unassign_vendor",
        )
        await apply_group_status_to_passengers(db, group_id, old_status, SUBMITTED_STATUS)

        updated = await db.groups.find_one({"id": group_id}, {"_id": 0})
        return {"status": "success", "group_id": group_id, "group": updated}

    @api_router.get("/vendors/{vendor_id}/groups")
    async def get_vendor_groups(vendor_id: str, current_user: dict = Depends(get_current_user)):
        if is_vendor_role(current_user) and current_user.get("vendor_id") != vendor_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if not is_system_role(current_user) and not is_vendor_role(current_user):
            raise HTTPException(status_code=403, detail="Access denied")

        groups = await db.groups.find({
            "assigned_vendor_id": vendor_id,
            "is_archived": {"$ne": True},
        }, {"_id": 0}).to_list(1000)
        return groups

    @api_router.post("/groups/{group_id}/upload/visas")
    async def upload_visa_files(
        group_id: str,
        files: List[UploadFile] = File(...),
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_upload_files")
        group = await verify_group_access(group_id, current_user)
        if is_vendor_role(current_user) and group.get("assigned_vendor_id") != current_user.get("vendor_id"):
            raise HTTPException(status_code=403, detail="Access denied")

        results = []
        for file in files:
            passport_no = file.filename.rsplit(".", 1)[0].upper() if file.filename else ""
            passport = await db.passports.find_one({"group_id": group_id, "passport_no": passport_no})
            if passport:
                content = await file.read()
                url = f"/api/uploads/visas/{group_id}/{file.filename}"
                upload_dir = Path(__file__).parent / "uploads" / "visas" / group_id
                upload_dir.mkdir(parents=True, exist_ok=True)
                async with aiofiles.open(upload_dir / file.filename, "wb") as f:
                    await f.write(content)
                now = datetime.now(timezone.utc).isoformat()
                await db.passports.update_one(
                    {"id": passport["id"]},
                    {"$set": {
                        "visa_pdf": url,
                        "visa_status": "visa_issued",
                        "visa_status_updated_at": now,
                        "status": "done",
                        "status_updated_at": now,
                    }},
                )
                results.append({"filename": file.filename, "matched": True, "passport_no": passport_no})
            else:
                results.append({"filename": file.filename, "matched": False, "passport_no": passport_no})
        await reconcile_group_status(db, group_id, user_id=current_user["id"])
        return {"uploaded": len(results), "results": results}

    # --- Notifications ---
    @api_router.get("/notifications")
    async def get_notifications(current_user: dict = Depends(get_current_user)):
        notifs = await db.notifications.find(
            {"user_id": current_user["id"]},
            {"_id": 0},
        ).sort("created_at", -1).to_list(50)
        return notifs

    @api_router.get("/notifications/unread-count")
    async def unread_count(current_user: dict = Depends(get_current_user)):
        count = await db.notifications.count_documents({
            "user_id": current_user["id"],
            "read_at": None,
        })
        return {"count": count}

    @api_router.patch("/notifications/{notification_id}/read")
    async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
        result = await db.notifications.update_one(
            {"id": notification_id, "user_id": current_user["id"]},
            {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"status": "success"}
