"""Enterprise feature tests for permissions, group IDs, and status workflow."""

import asyncio
import pytest
from permissions import (
    check_permission,
    get_role_permissions,
    normalize_role,
    migrate_role,
    can_access_group,
    can_access_client_financial,
    VALID_STATUS_TRANSITIONS,
    GROUP_STATUSES,
)
from group_id import preview_group_id


class FakeDB:
    class Counters:
        def __init__(self, parent):
            self._parent = parent

        async def find_one(self, query):
            return self._parent._counter_data.get(query.get("_id"))

        async def find_one_and_update(self, query, update, upsert=False, return_document=None):
            key = query["_id"]
            if key not in self._parent._counter_data:
                self._parent._counter_data[key] = {"_id": key, "seq": 0}
            self._parent._counter_data[key]["seq"] += update["$inc"]["seq"]
            return self._parent._counter_data[key]

    def __init__(self):
        self._counter_data = {}
        self.counters = FakeDB.Counters(self)


def test_group_id_preview_format():
    async def _run():
        db = FakeDB()
        group_id = await preview_group_id(db, "2026-04-15")
        assert group_id.startswith("GRP-2026-15APR-")
    asyncio.run(_run())


def test_system_admin_has_manage_vendors():
    user = {"role": "system_admin", "status": "active"}
    assert check_permission(user, "can_manage_vendors") is True


def test_client_accounts_cannot_view_operational():
    user = {"role": "client_accounts", "status": "active", "client_id": "c1"}
    assert check_permission(user, "can_view_operational") is False
    assert check_permission(user, "can_access_financial") is True
    assert check_permission(user, "can_view_global_accounting") is False
    assert check_permission(user, "can_view_client_ledger") is True


def test_client_admin_client_ledger_only():
    user = {"role": "client_admin", "status": "active", "client_id": "c1"}
    assert check_permission(user, "can_access_financial") is False
    assert check_permission(user, "can_view_global_accounting") is False
    assert check_permission(user, "can_view_client_ledger") is True
    assert check_permission(user, "can_record_receipts") is False
    assert check_permission(user, "can_submit_group") is True
    assert check_permission(user, "can_update_group_status") is False
    assert check_permission(user, "can_split_groups") is False
    assert check_permission(user, "can_update_passport_status") is False
    assert check_permission(user, "can_manage_submission_details") is False
    assert can_access_group(user, {"client_id": "c1"}) is True
    assert can_access_group(user, {"client_id": "c2"}) is False
    assert can_access_client_financial(user, "c1") is True
    assert can_access_client_financial(user, "c2") is False


def test_system_accounts_global_accounting():
    user = {"role": "system_accounts", "status": "active"}
    assert check_permission(user, "can_view_global_accounting") is True
    assert check_permission(user, "can_access_financial") is True


def test_vendor_scoped_permissions():
    user = {"role": "vendor_staff", "status": "active", "vendor_id": "v1"}
    perms = get_role_permissions(user)
    assert perms["can_upload_files"] is True
    assert perms["can_manage_vendors"] is False


def test_role_migration():
    assert migrate_role("super_admin", None, None) == "system_admin"
    assert migrate_role("staff", "c1", None) == "client_staff"
    assert migrate_role("staff", None, "v1") == "vendor_staff"


def test_status_transitions_defined():
    assert "DATA_PROCESSING" in VALID_STATUS_TRANSITIONS
    assert "SUBMITTED_FOR_PROCESS" in VALID_STATUS_TRANSITIONS["DATA_PROCESSING"]
    assert "SUBMITTED_FOR_PROCESS" not in VALID_STATUS_TRANSITIONS["VENDOR_ASSIGNED"]
    assert "VENDOR_ASSIGNED" in VALID_STATUS_TRANSITIONS["VISA_REJECTED"]
    assert "SUBMITTED_FOR_PROCESS" not in VALID_STATUS_TRANSITIONS["VISA_REJECTED"]
    assert len(GROUP_STATUSES) == 6
    assert "VISA_ISSUED" in VALID_STATUS_TRANSITIONS["VISA_IN_PROCESS"]
    assert "VISA_REJECTED" in VALID_STATUS_TRANSITIONS["VISA_IN_PROCESS"]


def test_legacy_role_normalization():
    assert normalize_role("admin") == "system_admin"
    assert normalize_role("super_admin") == "system_admin"
