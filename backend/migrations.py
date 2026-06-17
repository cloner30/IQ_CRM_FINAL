"""One-time startup migrations for enterprise schema."""

import logging
from permissions import migrate_role, VALID_ROLES
from group_status import DEFAULT_STATUS, STATUS_MIGRATION_MAP
from accounting import HIDDEN_COA_CODES

logger = logging.getLogger(__name__)


async def ensure_indexes(db):
    await db.groups.create_index("departure_date")
    await db.groups.create_index("assigned_vendor_id")
    await db.groups.create_index("status")
    await db.status_history.create_index("group_id")
    await db.notifications.create_index("user_id")
    await db.vendors.create_index("code", unique=True)
    await db.accounts.create_index("code", unique=True)
    await db.journal_entries.create_index("entry_date")
    await db.journal_entries.create_index("debit_account_id")
    await db.journal_entries.create_index("credit_account_id")
    await db.client_receipts.create_index("client_id")
    await db.client_receipts.create_index("receipt_number", unique=True)
    await db.vendor_payables.create_index("vendor_id")
    await db.vendor_payables.create_index("status")
    await db.vendor_payments.create_index("vendor_id")
    await db.vendor_payments.create_index("payment_number", unique=True)


async def deactivate_bank_accounts(db):
    """Deactivate legacy bank and unused accrual accounts."""
    result = await db.accounts.update_many(
        {"code": {"$in": list(HIDDEN_COA_CODES)}},
        {"$set": {"is_active": False}},
    )
    if result.modified_count:
        logger.info("Deactivated %d legacy/unused accounts", result.modified_count)


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
        {"$set": {"status": DEFAULT_STATUS, "is_archived": False}},
    )
    if result.modified_count:
        logger.info("Set default status on %d groups", result.modified_count)


async def migrate_group_status_codes(db):
    """Rename legacy group status codes to the unified workflow codes."""
    migrated_groups = 0
    for old_code, new_code in STATUS_MIGRATION_MAP.items():
        if old_code == new_code:
            continue
        result = await db.groups.update_many(
            {"status": old_code},
            {"$set": {"status": new_code}},
        )
        migrated_groups += result.modified_count

    migrated_history = 0
    for old_code, new_code in STATUS_MIGRATION_MAP.items():
        if old_code == new_code:
            continue
        r_old = await db.status_history.update_many(
            {"old_status": old_code},
            {"$set": {"old_status": new_code}},
        )
        r_new = await db.status_history.update_many(
            {"new_status": old_code},
            {"$set": {"new_status": new_code}},
        )
        migrated_history += r_old.modified_count + r_new.modified_count

    if migrated_groups or migrated_history:
        logger.info(
            "Migrated group statuses: %d groups, %d history fields",
            migrated_groups,
            migrated_history,
        )


async def run_migrations(db):
    await ensure_indexes(db)
    await migrate_user_roles(db)
    await migrate_groups_defaults(db)
    await migrate_group_status_codes(db)
    await deactivate_bank_accounts(db)
