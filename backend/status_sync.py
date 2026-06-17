"""Bidirectional sync between group workflow status and passenger statuses."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from group_status import (
    DEFAULT_STATUS,
    SUBMITTED_STATUS,
    VENDOR_ASSIGNED_STATUS,
    normalize_status,
)

FORMS_DONE_VISA = frozenset({"form_submitted", "payment_done", "visa_issued", "visa_rejected"})
PAYMENT_OR_BEYOND = frozenset({"payment_done", "visa_issued", "visa_rejected"})
TERMINAL_VISA = frozenset({"visa_issued", "visa_rejected"})
TERMINAL_GROUP = frozenset({"VISA_ISSUED", "VISA_REJECTED"})


async def log_status_change(
    db,
    group_id: str,
    old_status: str,
    new_status: str,
    user_id: str,
    reason: str = "",
    action: Optional[str] = None,
) -> dict:
    entry = {
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by_user_id": user_id,
        "reason": reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if action:
        entry["action"] = action
    await db.status_history.insert_one(entry)
    return entry


async def get_passenger_aggregate(db, group_id: str) -> Dict[str, Any]:
    passports = await db.passports.find(
        {"group_id": group_id},
        {"_id": 0, "status": 1, "visa_status": 1},
    ).to_list(10000)

    total = len(passports)
    if total == 0:
        return {
            "total": 0,
            "all_pending_form": True,
            "all_forms_done": False,
            "all_payment_done": False,
            "all_issued": False,
            "any_rejected": False,
            "all_terminal": False,
        }

    def form_done(p: dict) -> bool:
        return p.get("status") == "done" or p.get("visa_status") in FORMS_DONE_VISA

    all_pending_form = all(
        p.get("status") == "pending" and p.get("visa_status", "pending") == "pending"
        for p in passports
    )
    all_forms_done = all(form_done(p) for p in passports)
    all_payment_done = all(p.get("visa_status") in PAYMENT_OR_BEYOND for p in passports)
    all_issued = all(p.get("visa_status") == "visa_issued" for p in passports)
    any_rejected = any(p.get("visa_status") == "visa_rejected" for p in passports)
    all_terminal = all(p.get("visa_status") in TERMINAL_VISA for p in passports)

    return {
        "total": total,
        "all_pending_form": all_pending_form,
        "all_forms_done": all_forms_done,
        "all_payment_done": all_payment_done,
        "all_issued": all_issued,
        "any_rejected": any_rejected,
        "all_terminal": all_terminal,
    }


def validate_group_transition_aggregate(
    old_status: str,
    new_status: str,
    agg: Dict[str, Any],
    _has_vendor: bool = False,
) -> None:
    if new_status == "VISA_IN_PROCESS" and not agg["all_forms_done"]:
        raise HTTPException(
            status_code=400,
            detail="All passengers must complete forms before moving to Visa In Process",
        )
    if new_status == VENDOR_ASSIGNED_STATUS and old_status == SUBMITTED_STATUS:
        return
    if new_status in TERMINAL_GROUP:
        raise HTTPException(
            status_code=400,
            detail="Use complete-visa-outcome to set Visa Issued or Visa Rejected",
        )


async def apply_group_status_to_passengers(
    db,
    group_id: str,
    old_status: str,
    new_status: str,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    old_status = normalize_status(old_status)
    new_status = normalize_status(new_status)

    if new_status == DEFAULT_STATUS:
        await db.passports.update_many(
            {"group_id": group_id},
            {
                "$set": {
                    "status": "pending",
                    "visa_status": "pending",
                    "status_updated_at": None,
                    "visa_status_updated_at": None,
                }
            },
        )
        return

    if old_status == "VISA_REJECTED" and new_status in {DEFAULT_STATUS, VENDOR_ASSIGNED_STATUS}:
        await db.passports.update_many(
            {"group_id": group_id, "visa_status": "visa_rejected"},
            {
                "$set": {
                    "status": "pending",
                    "visa_status": "pending",
                    "status_updated_at": None,
                    "visa_status_updated_at": now,
                }
            },
        )
        return

    if new_status == "VISA_IN_PROCESS":
        await db.passports.update_many(
            {
                "group_id": group_id,
                "status": "done",
                "visa_status": "pending",
            },
            {
                "$set": {
                    "visa_status": "form_submitted",
                    "visa_status_updated_at": now,
                }
            },
        )


def build_passport_status_update(status: str, current_visa_status: str, now: str) -> dict:
    update_data = {
        "status": status,
        "status_updated_at": now if status == "done" else None,
    }
    if status == "done":
        update_data["visa_status"] = "form_submitted"
        update_data["visa_status_updated_at"] = now
    elif status == "pending" and current_visa_status in {"pending", "form_submitted"}:
        update_data["visa_status"] = "pending"
        update_data["visa_status_updated_at"] = None
    return update_data


def build_passport_visa_update(visa_status: str, now: str) -> dict:
    update_data = {
        "visa_status": visa_status,
        "visa_status_updated_at": now,
    }
    if visa_status == "form_submitted":
        update_data["status"] = "done"
        update_data["status_updated_at"] = now
    elif visa_status == "pending":
        update_data["status"] = "pending"
        update_data["status_updated_at"] = None
    return update_data


async def reconcile_group_status(
    db,
    group_id: str,
    user_id: str = "system",
    reason_prefix: str = "Auto-sync from passenger status",
) -> Optional[str]:
    """Promote or demote group status based on passenger aggregates. Returns new status if changed."""
    group = await db.groups.find_one({"id": group_id})
    if not group:
        return None

    current = normalize_status(group.get("status", DEFAULT_STATUS))
    agg = await get_passenger_aggregate(db, group_id)
    if agg["total"] == 0:
        return current

    has_vendor = bool(group.get("assigned_vendor_id"))
    new_status = current

    if current in TERMINAL_GROUP:
        if not agg["all_terminal"]:
            new_status = "VISA_IN_PROCESS"
        elif agg["all_issued"]:
            new_status = "VISA_ISSUED"
        elif agg["any_rejected"]:
            new_status = "VISA_REJECTED"
    elif current == "VISA_IN_PROCESS":
        if agg["all_terminal"]:
            new_status = "VISA_REJECTED" if agg["any_rejected"] else "VISA_ISSUED"
        elif not agg["all_forms_done"]:
            new_status = VENDOR_ASSIGNED_STATUS if has_vendor else SUBMITTED_STATUS
    elif current == VENDOR_ASSIGNED_STATUS:
        if agg["all_forms_done"]:
            new_status = "VISA_IN_PROCESS"
    elif current == SUBMITTED_STATUS:
        if agg["all_forms_done"] and has_vendor:
            new_status = "VISA_IN_PROCESS"

    if new_status == current:
        return current

    await db.groups.update_one({"id": group_id}, {"$set": {"status": new_status}})
    await log_status_change(
        db,
        group_id,
        current,
        new_status,
        user_id,
        f"{reason_prefix}: {agg['total']} passenger(s)",
    )
    return new_status


async def sync_after_passenger_change(
    db,
    group_id: str,
    user_id: str = "system",
) -> Optional[str]:
    return await reconcile_group_status(db, group_id, user_id=user_id)
