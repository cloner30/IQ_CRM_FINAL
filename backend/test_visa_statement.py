"""Tests for visa details statement report."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

from accounting import (
    build_client_visa_statement,
    build_vendor_visa_statement,
    visa_statement_to_csv,
    _passport_display_name,
)


def test_passport_display_name_english():
    assert _passport_display_name({"first_name_en": "John", "surname_en": "Smith"}) == "John Smith"


def test_passport_display_name_arabic_fallback():
    assert _passport_display_name({"first_name_ar": "أحمد", "surname_ar": "علي"}) == "أحمد علي"


def test_passport_display_name_empty():
    assert _passport_display_name({}) == "—"


def test_client_visa_statement_with_opening_balance_and_period():
    db = MagicMock()
    db.clients.find_one = AsyncMock(return_value={
        "id": "c1",
        "name": "Acme Travel",
        "base_price_per_passport": 20.0,
        "rush_fee": 5.0,
    })

    groups = [
        {
            "id": "g-old",
            "name": "Old Group",
            "status": "VISA_ISSUED",
            "passenger_count": 1,
            "rush_fee": 0.0,
        },
        {
            "id": "g-new",
            "name": "New Group",
            "status": "SUBMITTED_FOR_PROCESS",
            "passenger_count": 2,
            "rush_fee": 10.0,
        },
    ]

    class GroupsCursor:
        async def to_list(self, n):
            return groups

    passports_by_group = {
        "g-old": [{"passport_no": "OLD001", "first_name_en": "Ali", "surname_en": "Hassan"}],
        "g-new": [
            {"passport_no": "NEW001", "first_name_en": "Sara", "surname_en": "Khan"},
            {"passport_no": "NEW002", "first_name_en": "Omar", "surname_en": "Lee"},
        ],
    }

    submission_dates = {
        "g-old": [{"timestamp": "2025-01-15T00:00:00Z"}],
        "g-new": [{"timestamp": "2025-03-01T00:00:00Z"}],
    }

    class HistCursor:
        def __init__(self, gid):
            self.gid = gid

        def sort(self, *args, **kwargs):
            return self

        def limit(self, n):
            return self

        async def to_list(self, n):
            return submission_dates.get(self.gid, [])

    def groups_find(query, projection):
        return GroupsCursor()

    def passports_find(query, projection):
        gid = query.get("group_id")

        class PassportCursor:
            def sort(self, *args, **kwargs):
                return self

            async def to_list(self, n):
                return passports_by_group.get(gid, [])

        return PassportCursor()

    def status_history_find(query, projection):
        return HistCursor(query.get("group_id"))

    db.groups.find = MagicMock(side_effect=groups_find)
    db.passports.find = MagicMock(side_effect=passports_find)
    db.status_history.find = MagicMock(side_effect=status_history_find)

    receipts = [
        {
            "receipt_number": "REC-002",
            "payment_date": "2025-03-10",
            "amount_usd": 30.0,
            "payment_method": "cash",
            "payment_reference": "REF2",
        },
    ]

    class ReceiptsCursor:
        async def to_list(self, n):
            return receipts

    db.client_receipts.find = MagicMock(return_value=ReceiptsCursor())

    result = asyncio.run(build_client_visa_statement(db, "c1", "2025-03-01", "2025-03-31"))

    assert result["party_type"] == "client"
    assert result["party_name"] == "Acme Travel"
    assert result["opening_balance"]["amount"] == 20.0
    assert result["opening_balance"]["side"] == "Dr"

    visa_lines = [l for l in result["lines"] if l["line_type"] == "visa"]
    assert len(visa_lines) == 2
    assert result["summary"]["visas_in_period"] == 2
    assert result["summary"]["total_charges"] == 50.0  # 2 visas @ 20 + rush 10

    rush_lines = [l for l in result["lines"] if l["line_type"] == "rush_fee"]
    assert len(rush_lines) == 1
    assert rush_lines[0]["debit"] == 10.0

    assert len(result["period_payments"]) == 1
    assert result["period_payments"][0]["amount_usd"] == 30.0

    payment_lines = [l for l in result["lines"] if l["line_type"] == "payment"]
    assert len(payment_lines) == 1

    assert result["summary"]["closing_balance"] == 40.0
    assert result["summary"]["closing_side"] == "Dr"


def test_vendor_visa_statement_per_passport():
    db = MagicMock()
    db.vendors.find_one = AsyncMock(return_value={"id": "v1", "name": "Visa Pro"})

    payables = [
        {
            "vendor_id": "v1",
            "group_ids": ["g1"],
            "unit_cost": 15.0,
            "total_passengers": 2,
            "quantity": 2,
            "created_at": "2025-02-01T00:00:00Z",
        },
    ]

    class PayablesCursor:
        async def to_list(self, n):
            return payables

    db.vendor_payables.find = MagicMock(return_value=PayablesCursor())
    db.groups.find_one = AsyncMock(return_value={
        "id": "g1",
        "name": "Group One",
        "assigned_at": "2025-02-01T10:00:00Z",
    })

    passports = [
        {"passport_no": "P001", "first_name_en": "A", "surname_en": "One"},
        {"passport_no": "P002", "first_name_en": "B", "surname_en": "Two"},
    ]

    class PassportCursor:
        def sort(self, *args, **kwargs):
            return self

        async def to_list(self, n):
            return passports

    db.passports.find = MagicMock(return_value=PassportCursor())

    class PaymentsCursor:
        async def to_list(self, n):
            return [{
                "payment_number": "VPAY-001",
                "payment_date": "2025-02-15",
                "amount_usd": 20.0,
                "payment_method": "wire",
                "payment_reference": "VREF1",
            }]

    db.vendor_payments.find = MagicMock(return_value=PaymentsCursor())

    result = asyncio.run(build_vendor_visa_statement(db, "v1", "2025-02-01", "2025-02-28"))

    assert result["party_type"] == "vendor"
    visa_lines = [l for l in result["lines"] if l["line_type"] == "visa"]
    assert len(visa_lines) == 2
    assert visa_lines[0]["rate"] == 15.0
    assert visa_lines[0]["passport_no"] == "P001"
    assert result["summary"]["total_charges"] == 30.0
    assert result["summary"]["total_payments"] == 20.0
    assert result["summary"]["closing_balance"] == 10.0


def test_visa_statement_csv_export():
    statement = {
        "lines": [{
            "sr_no": 1,
            "date": "2025-01-01",
            "group_id": "g1",
            "pax_name": "Test User",
            "passport_no": "ABC123",
            "rate": 20.0,
            "debit": 20.0,
            "credit": None,
            "running_balance": 20.0,
            "balance_side": "Dr",
            "particulars": "Visa",
        }],
    }
    csv_text = visa_statement_to_csv(statement)
    assert "Sr No" in csv_text
    assert "ABC123" in csv_text
    assert "20.00" in csv_text
