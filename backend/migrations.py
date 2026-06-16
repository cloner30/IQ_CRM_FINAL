"""One-time startup migrations for enterprise schema."""

import logging
from permissions import migrate_role, VALID_ROLES

logger = logging.getLogger(__name__)


async def ensure_indexes(db):
    await db.groups.create_index("departure_date")
    await db.groups.create_index("assigned_vendor_id")
    await db.groups.create_index("status")
    await db.invoices.create_index("group_id")
    await db.invoices.create_index("invoice_number", unique=True)
    await db.status_history.create_index("group_id")
    await db.notifications.create_index("user_id")
    await db.vendor_payments.create_index("group_id")
    await db.vendors.create_index("code", unique=True)


async def migrate_user_roles(db):
    users = await db.users.find({}).to_list(10000)
    migrated = 0
    for user in users:
        old_role = user.get("role", "staff")
        if old_role in VALID_ROLES:
            updates = {}
            if not user.get("status"):
                updates["status"] = "active"
            if updates:
                await db.users.update_one({"id": user["id"]}, {"$set": updates})
            continue
        new_role = migrate_role(old_role, user.get("client_id"), user.get("vendor_id"))
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"role": new_role, "status": user.get("status", "active")}},
        )
        migrated += 1
    if migrated:
        logger.info("Migrated %d user roles to enterprise roles", migrated)


async def migrate_groups_defaults(db):
    result = await db.groups.update_many(
        {"status": {"$exists": False}},
        {"$set": {"status": "DATA_ENTRY", "is_archived": False}},
    )
    if result.modified_count:
        logger.info("Set default status on %d groups", result.modified_count)


async def run_migrations(db):
    await ensure_indexes(db)
    await migrate_user_roles(db)
    await migrate_groups_defaults(db)
