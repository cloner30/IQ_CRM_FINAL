"""Enterprise API routes: vendors, financial, status workflow, notifications."""

import uuid
import logging
import aiofiles
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel, Field, ConfigDict

from permissions import (
    require_permission,
    check_permission,
    is_system_role,
    is_vendor_role,
    can_access_group,
    normalize_role,
    GROUP_STATUSES,
    VALID_STATUS_TRANSITIONS,
    VALID_ROLES,
)
from group_id import generate_group_id, preview_group_id
from notifications import send_notification, render_template, notify_users_by_role

logger = logging.getLogger(__name__)


class GroupStatusUpdate(BaseModel):
    new_status: str
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


class InvoiceCreate(BaseModel):
    group_id: str
    discount_percent: float = 0.0


class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    payment_method: str = "bank_transfer"


def register_enterprise_routes(api_router, db, get_current_user, verify_group_access, get_user_group_filter):
    """Register all enterprise endpoints on the main API router."""

    async def log_status_change(group_id, old_status, new_status, user_id, reason=""):
        entry = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "old_status": old_status,
            "new_status": new_status,
            "changed_by_user_id": user_id,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await db.status_history.insert_one(entry)
        return entry

    async def create_invoice_for_group(group_id: str, discount_percent: float = 0.0):
        group = await db.groups.find_one({"id": group_id})
        if not group:
            return None
        existing = await db.invoices.find_one({"group_id": group_id})
        if existing:
            return existing

        client = await db.clients.find_one({"id": group.get("client_id")}) or {}
        passport_count = await db.passports.count_documents({"group_id": group_id})
        passenger_count = group.get("passenger_count") or passport_count or 0
        base_rate = client.get("base_price_per_passport", 20.0)
        rush_fee = client.get("rush_fee", 0.0)
        subtotal = passenger_count * base_rate
        total = (subtotal + rush_fee) * (1 - discount_percent / 100)

        invoice = {
            "id": str(uuid.uuid4()),
            "group_id": group_id,
            "client_id": group.get("client_id"),
            "invoice_number": f"INV-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}",
            "issued_date": datetime.now(timezone.utc).isoformat(),
            "due_date": (datetime.now(timezone.utc) + timedelta(days=15)).isoformat(),
            "total_amount": round(total, 2),
            "currency": "USD",
            "status": "sent",
            "discount_percent": discount_percent,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.invoices.insert_one(invoice)

        title, body = render_template("group_submitted", {
            "group_id": group_id,
            "passenger_count": passenger_count,
            "amount": f"{total:.2f}",
            "due_date": invoice["due_date"][:10],
        })
        await notify_users_by_role(
            db, ["client_admin", "client_accounts", "system_admin", "super_admin"],
            "group_submitted",
            {"group_id": group_id, "passenger_count": passenger_count, "amount": f"{total:.2f}", "due_date": invoice["due_date"][:10]},
            group_id,
        )
        return invoice

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

        old_status = group.get("status", "DATA_ENTRY")
        new_status = status_data.new_status
        if new_status not in GROUP_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Use: {GROUP_STATUSES}")
        allowed = VALID_STATUS_TRANSITIONS.get(old_status, [])
        if new_status != old_status and new_status not in allowed:
            raise HTTPException(status_code=400, detail=f"Cannot transition from {old_status} to {new_status}")

        await db.groups.update_one({"id": group_id}, {"$set": {"status": new_status}})
        await log_status_change(group_id, old_status, new_status, current_user["id"], status_data.reason or "")

        if new_status == "SUBMITTED":
            await create_invoice_for_group(group_id)

        notif_map = {
            "VISA_SUBMITTED": "visa_submitted",
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
                "status": group.get("status", "DATA_ENTRY"),
                "is_archived": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.groups.insert_one(new_group)
            for p in batch:
                await db.passports.update_one({"id": p["id"]}, {"$set": {"group_id": new_id}})
            new_groups.append(new_group)

        await db.groups.update_one({"id": group_id}, {"$set": {"is_archived": True}})
        await log_status_change(group_id, group.get("status"), "COMPLETED", current_user["id"], split_data.reason or "Group split")

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

        old_status = group.get("status", "DATA_ENTRY")
        await db.groups.update_one(
            {"id": group_id},
            {"$set": {
                "assigned_vendor_id": body.vendor_id,
                "status": "PENDING_PROCESS",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        await log_status_change(group_id, old_status, "PENDING_PROCESS", current_user["id"], f"Assigned to {vendor['name']}")

        passport_count = await db.passports.count_documents({"group_id": group_id})
        amount = passport_count * vendor.get("base_cost_per_passport", 0)
        await db.vendor_payments.insert_one({
            "id": str(uuid.uuid4()),
            "vendor_id": body.vendor_id,
            "group_id": group_id,
            "amount": amount,
            "status": "payable",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

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
                await db.passports.update_one(
                    {"id": passport["id"]},
                    {"$set": {"visa_pdf": url, "visa_status": "visa_issued"}},
                )
                results.append({"filename": file.filename, "matched": True, "passport_no": passport_no})
            else:
                results.append({"filename": file.filename, "matched": False, "passport_no": passport_no})
        return {"uploaded": len(results), "results": results}

    # --- Financial ---
    @api_router.post("/invoices")
    async def create_invoice(body: InvoiceCreate, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_manage_financial")
        invoice = await create_invoice_for_group(body.group_id, body.discount_percent)
        if not invoice:
            raise HTTPException(status_code=404, detail="Group not found")
        return invoice

    @api_router.get("/invoices")
    async def list_invoices(
        group_id: Optional[str] = None,
        client_id: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_access_financial")
        query = {}
        if group_id:
            query["group_id"] = group_id
        if client_id:
            query["client_id"] = client_id
        if normalize_role(current_user.get("role")) == "client_accounts":
            query["client_id"] = current_user.get("client_id")
        invoices = await db.invoices.find(query, {"_id": 0}).to_list(1000)
        return invoices

    @api_router.patch("/invoices/{invoice_id}/mark-paid")
    async def mark_invoice_paid(invoice_id: str, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_manage_financial")
        result = await db.invoices.update_one(
            {"id": invoice_id},
            {"$set": {"status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return {"status": "success"}

    @api_router.post("/payments")
    async def create_payment(body: PaymentCreate, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_manage_financial")
        invoice = await db.invoices.find_one({"id": body.invoice_id})
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        payment = {
            "id": str(uuid.uuid4()),
            "invoice_id": body.invoice_id,
            "amount": body.amount,
            "payment_method": body.payment_method,
            "status": "completed",
            "date": datetime.now(timezone.utc).isoformat(),
        }
        await db.payments.insert_one(payment)
        if body.amount >= invoice.get("total_amount", 0):
            await db.invoices.update_one({"id": body.invoice_id}, {"$set": {"status": "paid"}})
        return payment

    @api_router.get("/financial/dashboard")
    async def financial_dashboard(current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_access_financial")
        since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        pipeline = [
            {"$match": {"created_at": {"$gte": since}}},
            {"$group": {
                "_id": None,
                "total_revenue": {"$sum": "$total_amount"},
                "invoices_paid": {"$sum": {"$cond": [{"$eq": ["$status", "paid"]}, "$total_amount", 0]}},
                "invoices_pending": {"$sum": {"$cond": [{"$ne": ["$status", "paid"]}, "$total_amount", 0]}},
            }},
        ]
        stats = await db.invoices.aggregate(pipeline).to_list(1)
        vendor_costs = await db.vendor_payments.find({"created_at": {"$gte": since}}).to_list(10000)
        total_cost = sum(p.get("amount", 0) for p in vendor_costs)
        total_revenue = stats[0].get("total_revenue", 0) if stats else 0
        profit = total_revenue - total_cost
        margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
        return {
            "revenue": total_revenue,
            "cost": total_cost,
            "profit": profit,
            "margin_percent": round(margin, 2),
            "invoices_paid": stats[0].get("invoices_paid", 0) if stats else 0,
            "invoices_pending": stats[0].get("invoices_pending", 0) if stats else 0,
        }

    @api_router.get("/groups/{group_id}/financial")
    async def group_financial(group_id: str, current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_access_financial")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        invoice = await db.invoices.find_one({"group_id": group_id}, {"_id": 0})
        vendor_payment = await db.vendor_payments.find_one({"group_id": group_id}, {"_id": 0})
        revenue = invoice.get("total_amount", 0) if invoice else 0
        cost = vendor_payment.get("amount", 0) if vendor_payment else 0
        return {
            "invoice": invoice,
            "vendor_payment": vendor_payment,
            "revenue": revenue,
            "cost": cost,
            "profit": revenue - cost,
        }

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
