"""Enterprise feature tests for permissions, group IDs, and status workflow."""

import pytest
from permissions import (
    check_permission,
    get_role_permissions,
    normalize_role,
    migrate_role,
    VALID_STATUS_TRANSITIONS,
    GROUP_STATUSES,
)
from group_id import preview_group_id


class FakeDB:
    counters = {}

    async def find_one(self, query):
        return self.counters.get(query.get("_id"))

    async def find_one_and_update(self, query, update, upsert=False, return_document=None):
        key = query["_id"]
        if key not in self.counters:
            self.counters[key] = {"_id": key, "seq": 0}
        self.counters[key]["seq"] += update["$inc"]["seq"]
        return self.counters[key]


@pytest.mark.asyncio
async def test_group_id_preview_format():
    db = FakeDB()
    group_id = await preview_group_id(db, "2026-04-15")
    assert group_id.startswith("GRP-2026-15APR-")


def test_system_admin_has_manage_vendors():
    user = {"role": "system_admin", "status": "active"}
    assert check_permission(user, "can_manage_vendors") is True


def test_client_accounts_cannot_view_operational():
    user = {"role": "client_accounts", "status": "active"}
    assert check_permission(user, "can_view_operational") is False
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
    assert "DATA_ENTRY" in VALID_STATUS_TRANSITIONS
    assert "SUBMITTED" in VALID_STATUS_TRANSITIONS["DATA_ENTRY"]
    assert len(GROUP_STATUSES) == 7


def test_legacy_role_normalization():
    assert normalize_role("admin") == "system_admin"
    assert normalize_role("super_admin") == "system_admin"
