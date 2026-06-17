"""Tests for org-scoped user admin access (client_admin / vendor_admin)."""

from permissions import can_access_user_for_admin


def test_vendor_admin_can_access_own_vendor_user():
    actor = {"role": "vendor_admin", "vendor_id": "v1"}
    target = {"role": "vendor_staff", "vendor_id": "v1"}
    assert can_access_user_for_admin(actor, target) is True


def test_vendor_admin_cannot_access_other_vendor_user():
    actor = {"role": "vendor_admin", "vendor_id": "v1"}
    target = {"role": "vendor_staff", "vendor_id": "v2"}
    assert can_access_user_for_admin(actor, target) is False


def test_vendor_admin_cannot_access_client_user():
    actor = {"role": "vendor_admin", "vendor_id": "v1"}
    target = {"role": "client_staff", "client_id": "c1"}
    assert can_access_user_for_admin(actor, target) is False


def test_vendor_admin_cannot_access_system_staff():
    actor = {"role": "vendor_admin", "vendor_id": "v1"}
    target = {"role": "system_staff"}
    assert can_access_user_for_admin(actor, target) is False


def test_client_admin_can_access_own_client_user():
    actor = {"role": "client_admin", "client_id": "c1"}
    target = {"role": "client_staff", "client_id": "c1"}
    assert can_access_user_for_admin(actor, target) is True


def test_client_admin_cannot_access_other_client_user():
    actor = {"role": "client_admin", "client_id": "c1"}
    target = {"role": "client_staff", "client_id": "c2"}
    assert can_access_user_for_admin(actor, target) is False


def test_system_admin_can_access_any_user():
    actor = {"role": "system_admin"}
    targets = [
        {"role": "vendor_staff", "vendor_id": "v1"},
        {"role": "client_staff", "client_id": "c1"},
        {"role": "system_staff"},
    ]
    for target in targets:
        assert can_access_user_for_admin(actor, target) is True


def test_system_staff_can_access_any_user():
    actor = {"role": "system_staff"}
    target = {"role": "client_staff", "client_id": "c1"}
    assert can_access_user_for_admin(actor, target) is True


def test_user_update_excludes_permissions_field():
    """UserUpdate must not accept a permissions field (privilege escalation guard)."""
    from server import UserUpdate

    fields = set(UserUpdate.model_fields.keys())
    assert "permissions" not in fields
