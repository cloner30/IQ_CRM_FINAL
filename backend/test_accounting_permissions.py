"""Tests for client ledger vs global accounting access boundaries."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

from fastapi import HTTPException

from permissions import (
    check_permission,
    require_global_accounting_access,
    require_client_ledger_access,
    require_permission,
    get_role_permissions,
    VALID_ROLES,
)
from accounting import (
    get_client_ledger,
    get_vendor_ledger,
    list_vendor_ledgers,
)


def test_all_roles_define_accounting_permissions():
    for role in VALID_ROLES:
        perms = get_role_permissions({"role": role, "status": "active"})
        assert "can_view_global_accounting" in perms
        assert "can_view_client_ledger" in perms
        assert "can_view_vendor_ledger" in perms
        assert "can_submit_group" in perms
        assert "can_update_passport_status" in perms
        assert "can_manage_submission_details" in perms


def test_client_admin_denied_global_accounting_and_receipts():
    user = {"role": "client_admin", "status": "active", "client_id": "c1"}
    try:
        require_global_accounting_access(user)
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403

    try:
        require_permission(user, "can_record_receipts")
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403

    assert check_permission(user, "can_view_client_ledger") is True
    assert check_permission(user, "can_access_financial") is False
    require_client_ledger_access(user, "c1")


def test_system_admin_allowed_global_accounting():
    user = {"role": "system_admin", "status": "active"}
    require_global_accounting_access(user)
    assert check_permission(user, "can_record_receipts") is True
    assert check_permission(user, "can_view_client_ledger") is False


def test_client_accounts_denied_global_accounting_has_client_ledger():
    user = {"role": "client_accounts", "status": "active", "client_id": "c1"}
    try:
        require_global_accounting_access(user)
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403

    assert check_permission(user, "can_view_global_accounting") is False
    assert check_permission(user, "can_view_client_ledger") is True
    assert check_permission(user, "can_record_receipts") is False
    assert check_permission(user, "can_access_financial") is True
    require_client_ledger_access(user, "c1")


def test_system_accounts_can_record_receipts():
    user = {"role": "system_accounts", "status": "active"}
    assert check_permission(user, "can_record_receipts") is True
    assert check_permission(user, "can_view_global_accounting") is True
    require_global_accounting_access(user)


def test_system_staff_cannot_record_receipts():
    user = {"role": "system_staff", "status": "active"}
    assert check_permission(user, "can_record_receipts") is False
    try:
        require_permission(user, "can_record_receipts")
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403


def test_client_ledger_scoped_to_own_client():
    client_admin = {"role": "client_admin", "status": "active", "client_id": "c1"}
    require_client_ledger_access(client_admin, "c1")
    try:
        require_client_ledger_access(client_admin, "c2")
        raise AssertionError("expected HTTPException")
    except HTTPException as exc:
        assert exc.status_code == 403


def test_system_admin_can_view_any_client_ledger():
    user = {"role": "system_admin", "status": "active"}
    require_client_ledger_access(user, "c1")
    require_client_ledger_access(user, "c2")


def test_receipt_list_access_matrix():
    client_admin = {"role": "client_admin", "status": "active", "client_id": "c1"}
    client_accounts = {"role": "client_accounts", "status": "active", "client_id": "c1"}
    system_admin = {"role": "system_admin", "status": "active"}

    assert check_permission(client_admin, "can_view_global_accounting") is False
    assert check_permission(client_accounts, "can_view_global_accounting") is False
    assert check_permission(system_admin, "can_view_global_accounting") is True

    assert check_permission(client_admin, "can_record_receipts") is False
    assert check_permission(client_accounts, "can_record_receipts") is False


def test_get_client_ledger_summary():
    db = MagicMock()
    db.clients.find_one = AsyncMock(return_value={
        "id": "c1",
        "name": "Acme Travel",
        "base_price_per_passport": 10,
        "rush_fee": 5,
    })

    class GroupsCursor:
        def sort(self, *args, **kwargs):
            return self

        async def to_list(self, n):
            return [{"id": "g1", "name": "Group A", "status": "SUBMITTED_FOR_PROCESS", "passenger_count": 2}]

    class ReceiptsCursor:
        def sort(self, *args, **kwargs):
            return self

        async def to_list(self, n):
            return [{
                "id": "r1",
                "receipt_number": "REC-001",
                "payment_date": "2025-01-01",
                "amount_usd": 25.0,
                "payment_method": "wire",
                "payment_reference": "REF1",
                "status": "recorded",
                "received_by_user_id": "u1",
            }]

    class HistCursor:
        def sort(self, *args, **kwargs):
            return self

        def limit(self, n):
            return self

        async def to_list(self, n):
            return [{"timestamp": "2025-01-01T00:00:00Z"}]

    db.groups.find = MagicMock(return_value=GroupsCursor())
    db.client_receipts.find = MagicMock(return_value=ReceiptsCursor())
    db.passports.count_documents = AsyncMock(return_value=2)
    db.status_history.find = MagicMock(return_value=HistCursor())
    db.users.find_one = AsyncMock(return_value={"name": "System User"})

    result = asyncio.run(get_client_ledger(db, "c1"))

    assert result["client_id"] == "c1"
    assert result["client_name"] == "Acme Travel"
    assert result["summary"]["groups_submitted"] == 1
    assert result["summary"]["total_passengers"] == 2
    assert result["summary"]["total_billed"] == 25.0
    assert result["summary"]["total_paid"] == 25.0
    assert result["summary"]["balance_due"] == 0.0
    assert result["receipts"][0]["recorded_by"] == "System User"


def test_get_vendor_ledger_summary():
    db = MagicMock()
    db.vendors.find_one = AsyncMock(return_value={"id": "v1", "name": "Vendor Co"})

    payable_doc = {
        "group_ids": ["g1"],
        "total_amount_usd": 500.0,
        "total_passengers": 10,
        "quantity": 10,
        "unit_cost": 50.0,
        "payable_number": "PAY-001",
        "created_at": "2025-01-01T00:00:00Z",
        "due_date": "2025-01-01",
    }
    payment_doc = {
        "id": "p1",
        "payment_number": "VPAY-001",
        "payment_date": "2025-01-01",
        "amount_usd": 200.0,
        "payment_method": "cash",
        "payment_reference": "REF1",
        "paid_by_user_id": "u1",
    }

    class PayablesCursor:
        def sort(self, *args, **kwargs):
            return self

        async def to_list(self, n):
            return [payable_doc]

    class PaymentsCursor:
        def sort(self, *args, **kwargs):
            return self

        async def to_list(self, n):
            return [payment_doc]

    db.vendor_payables.find = MagicMock(return_value=PayablesCursor())
    db.vendor_payments.find = MagicMock(return_value=PaymentsCursor())
    db.groups.find_one = AsyncMock(return_value={"name": "Group A", "status": "SUBMITTED_FOR_PROCESS"})
    db.users.find_one = AsyncMock(return_value={"name": "System User"})

    result = asyncio.run(get_vendor_ledger(db, "v1"))

    assert result["vendor_id"] == "v1"
    assert result["summary"]["total_owed"] == 500.0
    assert result["summary"]["total_visas_processed"] == 10
    assert result["summary"]["total_paid"] == 200.0
    assert result["summary"]["balance_due"] == 300.0
    assert len(result["statement"]) == 2
    assert result["statement"][-1]["running_balance"] == 300.0
    assert result["payments"][0]["recorded_by"] == "System User"


def test_list_vendor_ledgers():
    db = MagicMock()
    db.vendors.find = MagicMock(return_value=MagicMock(
        sort=MagicMock(return_value=MagicMock(
            to_list=AsyncMock(return_value=[
                {"id": "v1", "name": "Vendor Co"},
            ])
        ))
    ))
    db.vendor_payables.find = MagicMock(return_value=MagicMock(
        to_list=AsyncMock(return_value=[{
            "total_passengers": 5,
            "quantity": 5,
            "total_amount_usd": 100.0,
        }])
    ))
    db.vendor_payments.find = MagicMock(return_value=MagicMock(
        to_list=AsyncMock(return_value=[{"amount_usd": 40.0}])
    ))

    rows = asyncio.run(list_vendor_ledgers(db))
    assert len(rows) == 1
    assert rows[0]["vendor_name"] == "Vendor Co"
    assert rows[0]["total_visas_processed"] == 5
    assert rows[0]["total_owed"] == 100.0
    assert rows[0]["total_paid"] == 40.0
    assert rows[0]["balance_due"] == 60.0


def test_vendor_accounts_has_vendor_ledger():
    user = {"role": "vendor_accounts", "status": "active", "vendor_id": "v1"}
    assert check_permission(user, "can_view_vendor_ledger") is True
    assert check_permission(user, "can_view_global_accounting") is False
