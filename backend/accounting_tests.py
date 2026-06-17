"""Unit tests for ledger accounting."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

from accounting import (
    balance_delta,
    post_journal_entry,
    create_client_receipt,
    create_vendor_payable,
    create_vendor_payment,
    trial_balance,
    initialize_chart_of_accounts,
    build_party_statement,
)


def make_db():
    db = MagicMock()
    accounts = {}
    journal_entries = {}
    client_receipts = {}
    vendor_payables = {}
    vendor_payments = {}
    counters = {}

    async def find_one_and_update(filter_doc, update, upsert=False, return_document=None):
        cid = filter_doc["_id"]
        if cid not in counters:
            counters[cid] = {"_id": cid, "seq": 0}
        counters[cid]["seq"] += update["$inc"]["seq"]
        return counters[cid]

    async def accounts_find_one(query, projection=None):
        if "id" in query:
            return accounts.get(query["id"])
        if "code" in query:
            for a in accounts.values():
                if a["code"] == query["code"]:
                    if query.get("is_active") is True and not a.get("is_active"):
                        continue
                    return a
        return None

    async def accounts_update_one(query, update):
        acc = accounts.get(query["id"])
        if not acc:
            return MagicMock(matched_count=0)
        if "$inc" in update:
            acc["current_balance"] = acc.get("current_balance", 0) + update["$inc"].get("current_balance", 0)
        if "$set" in update:
            acc.update(update["$set"])
        return MagicMock(matched_count=1)

    async def accounts_insert_one(doc):
        accounts[doc["id"]] = doc

    def accounts_find(query, projection=None):
        class Cursor:
            async def to_list(self, n):
                items = list(accounts.values())
                if query.get("is_active"):
                    items = [a for a in items if a.get("is_active")]
                if query.get("account_type"):
                    items = [a for a in items if a["account_type"] == query["account_type"]]
                if query.get("category"):
                    cat = query["category"]
                    if isinstance(cat, dict) and "$in" in cat:
                        items = [a for a in items if a.get("category") in cat["$in"]]
                    elif isinstance(cat, str):
                        items = [a for a in items if a.get("category") == cat]
                return items
        return Cursor()

    async def accounts_count_documents(query):
        return len(accounts)

    async def je_insert_one(doc):
        journal_entries[doc["id"]] = doc

    async def je_find(query, projection=None):
        class Cursor:
            def sort(self, *a):
                return self
            async def to_list(self, n):
                return list(journal_entries.values())
        return Cursor()

    async def je_find_one(query, projection=None):
        return journal_entries.get(query.get("id"))

    async def je_update_one(query, update):
        je = journal_entries.get(query["id"])
        if je and "$set" in update:
            je.update(update["$set"])
        return MagicMock(matched_count=1 if je else 0)

    async def cr_insert_one(doc):
        client_receipts[doc["id"]] = doc

    async def vp_insert_one(doc):
        vendor_payables[doc["id"]] = doc

    async def vpay_insert_one(doc):
        vendor_payments[doc["id"]] = doc

    async def vp_find_one(query, projection=None):
        return vendor_payables.get(query.get("id"))

    db.counters = MagicMock()
    db.counters.find_one_and_update = AsyncMock(side_effect=find_one_and_update)
    db.accounts = MagicMock()
    db.accounts.find_one = AsyncMock(side_effect=accounts_find_one)
    db.accounts.update_one = AsyncMock(side_effect=accounts_update_one)
    db.accounts.insert_one = AsyncMock(side_effect=accounts_insert_one)
    db.accounts.find = MagicMock(side_effect=accounts_find)
    db.accounts.count_documents = AsyncMock(side_effect=accounts_count_documents)
    db.journal_entries = MagicMock()
    db.journal_entries.insert_one = AsyncMock(side_effect=je_insert_one)
    db.journal_entries.find = MagicMock(side_effect=je_find)
    db.journal_entries.find_one = AsyncMock(side_effect=je_find_one)
    db.journal_entries.update_one = AsyncMock(side_effect=je_update_one)
    db.client_receipts = MagicMock()
    db.client_receipts.insert_one = AsyncMock(side_effect=cr_insert_one)
    db.vendor_payables = MagicMock()
    db.vendor_payables.insert_one = AsyncMock(side_effect=vp_insert_one)
    db.vendor_payables.find_one = AsyncMock(side_effect=vp_find_one)
    db.vendor_payments = MagicMock()
    db.vendor_payments.insert_one = AsyncMock(side_effect=vpay_insert_one)

    db._accounts = accounts
    db._journal_entries = journal_entries
    return db


def test_build_party_statement_dr_cr():
    lines = build_party_statement(
        [{"date": "2026-01-10", "particulars": "Billing — Group A", "reference": "G1", "debit": 200}],
        [{"date": "2026-01-15", "particulars": "Receipt REC-001", "reference": "UTR1", "credit": 80}],
    )
    assert len(lines) == 2
    assert lines[0]["debit"] == 200
    assert lines[0]["running_balance"] == 200
    assert lines[0]["balance_side"] == "Dr"
    assert lines[1]["credit"] == 80
    assert lines[1]["running_balance"] == 120
    assert lines[1]["balance_side"] == "Dr"


def test_balance_delta_rules():
    assert balance_delta("asset", "debit", 100) == 100
    assert balance_delta("asset", "credit", 100) == -100
    assert balance_delta("income", "credit", 100) == 100
    assert balance_delta("expense", "debit", 50) == 50


def test_initialize_and_post_journal():
    async def _run():
        db = make_db()
        result = await initialize_chart_of_accounts(db)
        assert result["created"] is True
        assert len(db._accounts) == 4

        cash = next(a for a in db._accounts.values() if a["code"] == "1003")
        revenue = next(a for a in db._accounts.values() if a["code"] == "4001")

        await post_journal_entry(
            db,
            debit_account_id=cash["id"],
            credit_account_id=revenue["id"],
            amount=5000,
            entry_type="client_payment",
            entry_date="2026-06-15",
            description="Test payment",
            posted_by_user_id="user-1",
        )

        assert cash["current_balance"] == 5000
        assert revenue["current_balance"] == 5000
    asyncio.run(_run())


def test_client_receipt_creates_journal():
    async def _run():
        db = make_db()
        await initialize_chart_of_accounts(db)

        receipt = await create_client_receipt(
            db,
            client_id="c1",
            client_name="Test Client",
            amount_usd=1000,
            payment_date="2026-06-15",
            payment_method="cash",
            payment_reference="REF-1",
            notes=None,
            received_by_user_id="u1",
        )
        assert receipt["receipt_number"].startswith("REC-")
        assert receipt["status"] == "recorded"
        cash = next(a for a in db._accounts.values() if a["code"] == "1003")
        revenue = next(a for a in db._accounts.values() if a["code"] == "4001")
        assert cash["current_balance"] == 1000
        assert revenue["current_balance"] == 1000
    asyncio.run(_run())


def test_vendor_payment_creates_journal():
    async def _run():
        db = make_db()
        await initialize_chart_of_accounts(db)

        payment = await create_vendor_payment(
            db,
            vendor_id="v1",
            vendor_name="Vendor A",
            amount_usd=800,
            payment_date="2026-06-16",
            payment_method="cash",
            payment_reference="TXN-1",
            notes=None,
            paid_by_user_id="u1",
        )
        assert payment["payment_number"].startswith("VPAY-")
        costs = next(a for a in db._accounts.values() if a["code"] == "5001")
        cash = next(a for a in db._accounts.values() if a["code"] == "1003")
        assert costs["current_balance"] == 800
        assert cash["current_balance"] == -800
    asyncio.run(_run())


def test_create_vendor_payable_expected_cost():
    async def _run():
        db = make_db()
        await initialize_chart_of_accounts(db)

        payable = await create_vendor_payable(
            db,
            vendor_id="v1",
            vendor_name="Vendor A",
            group_ids=["GRP-001"],
            unit_cost=200,
            quantity=10,
            due_date="2026-07-01",
            notes=None,
            created_by_user_id="u1",
        )
        assert payable["total_amount_usd"] == 2000
        assert payable["balance_due"] == 2000
    asyncio.run(_run())


def test_trial_balance_balanced():
    async def _run():
        db = make_db()
        await initialize_chart_of_accounts(db)
        cash = next(a for a in db._accounts.values() if a["code"] == "1003")
        revenue = next(a for a in db._accounts.values() if a["code"] == "4001")
        await post_journal_entry(
            db,
            debit_account_id=cash["id"],
            credit_account_id=revenue["id"],
            amount=100,
            entry_type="client_payment",
            entry_date="2026-06-15",
            description="Test",
            posted_by_user_id="u1",
        )
        tb = await trial_balance(db)
        assert tb["balanced"] is True
    asyncio.run(_run())
