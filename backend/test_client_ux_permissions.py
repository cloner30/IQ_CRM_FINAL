"""Tests for client admin group detail UX permission boundaries."""

from fastapi import HTTPException

from permissions import (
    VALID_ROLES,
    check_permission,
    get_role_permissions,
    require_submit_group,
    require_passport_status_update,
    require_submission_details,
)


def test_all_roles_define_client_ux_permissions():
    for role in VALID_ROLES:
        perms = get_role_permissions({"role": role, "status": "active"})
        assert "can_submit_group" in perms
        assert "can_update_passport_status" in perms
        assert "can_manage_submission_details" in perms


def test_client_admin_client_facing_permissions():
    user = {"role": "client_admin", "status": "active", "client_id": "c1"}
    assert check_permission(user, "can_submit_group") is True
    assert check_permission(user, "can_view_client_ledger") is True
    assert check_permission(user, "can_record_receipts") is False
    assert check_permission(user, "can_access_financial") is False
    assert check_permission(user, "can_view_global_accounting") is False
    assert check_permission(user, "can_update_group_status") is False
    assert check_permission(user, "can_split_groups") is False
    assert check_permission(user, "can_update_passport_status") is False
    assert check_permission(user, "can_manage_submission_details") is False
    assert check_permission(user, "can_edit_passports") is True


def test_client_staff_data_entry_only():
    user = {"role": "client_staff", "status": "active", "client_id": "c1"}
    assert check_permission(user, "can_submit_group") is False
    assert check_permission(user, "can_update_group_status") is False
    assert check_permission(user, "can_update_passport_status") is False
    assert check_permission(user, "can_manage_submission_details") is False
    assert check_permission(user, "can_edit_passports") is True


def test_system_staff_ops_permissions():
    user = {"role": "system_staff", "status": "active"}
    assert check_permission(user, "can_submit_group") is False
    assert check_permission(user, "can_update_group_status") is True
    assert check_permission(user, "can_update_passport_status") is True
    assert check_permission(user, "can_manage_submission_details") is True


def test_vendor_staff_passport_status_only():
    user = {"role": "vendor_staff", "status": "active", "vendor_id": "v1"}
    assert check_permission(user, "can_update_passport_status") is True
    assert check_permission(user, "can_manage_submission_details") is False
    assert check_permission(user, "can_submit_group") is False


def _expect_403(fn, user):
    try:
        fn(user)
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403


def test_client_admin_denied_ops_guards():
    client_admin = {"role": "client_admin", "status": "active", "client_id": "c1"}
    client_staff = {"role": "client_staff", "status": "active", "client_id": "c1"}

    require_submit_group(client_admin)

    _expect_403(require_submit_group, client_staff)
    _expect_403(require_passport_status_update, client_admin)
    _expect_403(require_passport_status_update, client_staff)
    _expect_403(require_submission_details, client_admin)
    _expect_403(require_submission_details, client_staff)

    require_passport_status_update({"role": "system_staff", "status": "active"})
    require_submission_details({"role": "system_admin", "status": "active"})
