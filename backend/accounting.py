"""Ledger-based double-entry accounting service."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException

from group_status import DEFAULT_STATUS, SUBMITTED_STATUS

logger = logging.getLogger(__name__)

CHART_OF_ACCOUNTS = [
    {"code": "1003", "name": "Cash on Hand", "account_type": "asset", "category": "cash", "currency": "USD"},
    {"code": "3001", "name": "Opening Balance", "account_type": "equity", "category": "equity", "currency": "USD"},
    {"code": "4001", "name": "Group Service Revenue", "account_type": "income", "category": "income", "currency": "USD"},
    {"code": "5001", "name": "Vendor Costs", "account_type": "expense", "category": "expense", "currency": "USD"},
]

HIDDEN_COA_CODES = {"1001", "1002", "1100", "2001"}

REVENUE_ACCOUNT_CODE = "4001"
VENDOR_COSTS_ACCOUNT_CODE = "5001"
DEFAULT_CASH_ACCOUNT_CODE = "1003"

DEBIT_NORMAL_TYPES = {"asset", "expense"}

DEFAULT_BASE_PRICE_PER_PASSPORT = 20.0


def _date_only(value: Optional[str], fallback: str = "1970-01-01") -> str:
    if not value:
        return fallback
    return str(value)[:10]


def build_party_statement(charge_lines: List[dict], payment_lines: List[dict]) -> List[dict]:
    """Merge charge (Dr) and payment (Cr) lines into a chronological statement with running balance."""
    rows = []
    for item in charge_lines:
        rows.append({
            "entry_date": _date_only(item.get("date")),
            "particulars": item.get("particulars", ""),
            "reference": item.get("reference", ""),
            "debit": round(float(item.get("debit", 0)), 2),
            "credit": 0.0,
            "sort_order": 0,
        })
    for item in payment_lines:
        rows.append({
            "entry_date": _date_only(item.get("date")),
            "particulars": item.get("particulars", ""),
            "reference": item.get("reference", ""),
            "debit": 0.0,
            "credit": round(float(item.get("credit", 0)), 2),
            "sort_order": 1,
        })
    rows.sort(key=lambda r: (r["entry_date"], r["sort_order"], r["reference"]))
    balance = 0.0
    statement = []
    for row in rows:
        balance = round(balance + row["debit"] - row["credit"], 2)
        statement.append({
            "entry_date": row["entry_date"],
            "particulars": row["particulars"],
            "reference": row["reference"],
            "debit": row["debit"] if row["debit"] else None,
            "credit": row["credit"] if row["credit"] else None,
            "running_balance": abs(balance),
            "balance_side": "Dr" if balance >= 0 else "Cr",
        })
    return statement


def resolve_group_pricing(group: dict, client: dict) -> tuple:
    """Resolve effective per-group selling rate, falling back to client defaults."""
    base = group.get("base_price_per_passport")
    if base is None:
        base = client.get("base_price_per_passport", DEFAULT_BASE_PRICE_PER_PASSPORT)
    rush = group.get("rush_fee")
    if rush is None:
        rush = client.get("rush_fee", 0.0)
    return float(base), float(rush)


def compute_suggested_revenue(passenger_count: int, group: dict, client: dict) -> float:
    base, rush = resolve_group_pricing(group, client)
    return round(passenger_count * base + rush, 2)


def is_custom_group_pricing(group: dict, client: dict) -> bool:
    c_base = client.get("base_price_per_passport", DEFAULT_BASE_PRICE_PER_PASSPORT)
    c_rush = client.get("rush_fee", 0.0)
    g_base = group.get("base_price_per_passport")
    g_rush = group.get("rush_fee")
    if g_base is not None and float(g_base) != float(c_base):
        return True
    if g_rush is not None and float(g_rush) != float(c_rush):
        return True
    return False


def pricing_breakdown(group: dict, client: dict, passenger_count: int) -> dict:
    base, rush = resolve_group_pricing(group, client)
    return {
        "base_price_per_passport": round(base, 2),
        "rush_fee": round(rush, 2),
        "client_base_price_per_passport": round(
            float(client.get("base_price_per_passport", DEFAULT_BASE_PRICE_PER_PASSPORT)), 2
        ),
        "client_rush_fee": round(float(client.get("rush_fee", 0.0)), 2),
        "is_custom_pricing": is_custom_group_pricing(group, client),
        "passenger_count": passenger_count,
        "suggested_revenue": compute_suggested_revenue(passenger_count, group, client),
    }


async def next_sequence(db, prefix: str, year: int) -> int:
    counter_id = f"{prefix}_{year}"
    result = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return result["seq"]


async def generate_entry_number(db, prefix: str) -> str:
    year = datetime.now(timezone.utc).year
    seq = await next_sequence(db, prefix, year)
    return f"{prefix}-{year}-{seq:05d}"


def balance_delta(account_type: str, side: str, amount: float) -> float:
    """Return signed change to current_balance for debit/credit on account type."""
    if account_type in DEBIT_NORMAL_TYPES:
        return amount if side == "debit" else -amount
    return amount if side == "credit" else -amount


async def get_account_by_id(db, account_id: str) -> dict:
    account = await db.accounts.find_one({"id": account_id}, {"_id": 0})
    if not account:
        account = await db.accounts.find_one({"code": account_id}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def get_cash_account(db) -> dict:
    account = await db.accounts.find_one({"code": DEFAULT_CASH_ACCOUNT_CODE, "is_active": True}, {"_id": 0})
    if not account:
        account = await db.accounts.find_one({"code": DEFAULT_CASH_ACCOUNT_CODE}, {"_id": 0})
    if not account:
        raise HTTPException(status_code=400, detail="Chart of accounts not initialized (Cash on Hand missing)")
    return account


async def initialize_chart_of_accounts(db) -> dict:
    existing = await db.accounts.count_documents({})
    if existing > 0:
        return {"created": False, "message": "Chart of accounts already initialized", "count": existing}

    now = datetime.now(timezone.utc).isoformat()
    created = 0
    for item in CHART_OF_ACCOUNTS:
        doc = {
            "id": str(uuid.uuid4()),
            "code": item["code"],
            "name": item["name"],
            "account_type": item["account_type"],
            "category": item["category"],
            "currency": item.get("currency", "USD"),
            "opening_balance": 0.0,
            "current_balance": 0.0,
            "last_updated": now,
            "description": None,
            "is_active": True,
            "created_at": now,
        }
        await db.accounts.insert_one(doc)
        created += 1
    return {"created": True, "count": created}


async def update_account_balance(db, account_id: str, delta: float) -> None:
    now = datetime.now(timezone.utc).isoformat()
    result = await db.accounts.update_one(
        {"id": account_id},
        {"$inc": {"current_balance": delta}, "$set": {"last_updated": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found for balance update")


async def post_journal_entry(
    db,
    *,
    debit_account_id: str,
    credit_account_id: str,
    amount: float,
    entry_type: str,
    entry_date: str,
    description: str,
    posted_by_user_id: str,
    related_entity_type: Optional[str] = None,
    related_entity_id: Optional[str] = None,
    reference_number: Optional[str] = None,
    receipt_number: Optional[str] = None,
    status: str = "posted",
) -> dict:
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    debit_account = await get_account_by_id(db, debit_account_id)
    credit_account = await get_account_by_id(db, credit_account_id)
    if debit_account["id"] == credit_account["id"]:
        raise HTTPException(status_code=400, detail="Debit and credit accounts must differ")

    entry_number = await generate_entry_number(db, "JE")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "entry_number": entry_number,
        "entry_date": entry_date,
        "entry_type": entry_type,
        "related_entity_type": related_entity_type,
        "related_entity_id": related_entity_id,
        "debit_account_id": debit_account["id"],
        "credit_account_id": credit_account["id"],
        "amount": round(amount, 2),
        "description": description,
        "reference_number": reference_number,
        "receipt_number": receipt_number,
        "status": status,
        "posted_by_user_id": posted_by_user_id,
        "posted_at": now,
        "reversed_by_entry_id": None,
        "reversal_reason": None,
    }
    await db.journal_entries.insert_one(entry)

    debit_delta = balance_delta(debit_account["account_type"], "debit", amount)
    credit_delta = balance_delta(credit_account["account_type"], "credit", amount)
    await update_account_balance(db, debit_account["id"], debit_delta)
    await update_account_balance(db, credit_account["id"], credit_delta)
    return entry


async def reverse_journal_entry(db, entry_id: str, reason: str, user_id: str) -> dict:
    original = await db.journal_entries.find_one({"id": entry_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if original.get("status") == "reversed":
        raise HTTPException(status_code=400, detail="Entry already reversed")

    reversal = await post_journal_entry(
        db,
        debit_account_id=original["credit_account_id"],
        credit_account_id=original["debit_account_id"],
        amount=original["amount"],
        entry_type="reversal",
        entry_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        description=f"Reversal of {original['entry_number']}: {reason}",
        posted_by_user_id=user_id,
        reference_number=original.get("reference_number"),
        status="posted",
    )
    now = datetime.now(timezone.utc).isoformat()
    await db.journal_entries.update_one(
        {"id": entry_id},
        {"$set": {"status": "reversed", "reversed_by_entry_id": reversal["id"], "reversal_reason": reason, "reversed_at": now}},
    )
    reversal["reverses_entry_id"] = entry_id
    return reversal


async def get_account_ledger(
    db,
    account_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> List[dict]:
    account = await get_account_by_id(db, account_id)
    query = {
        "$or": [
            {"debit_account_id": account["id"]},
            {"credit_account_id": account["id"]},
        ],
        "status": {"$ne": "reversed"},
    }
    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = from_date
        if to_date:
            date_filter["$lte"] = to_date
        query["entry_date"] = date_filter

    entries = await db.journal_entries.find(query, {"_id": 0}).sort("entry_date", 1).to_list(10000)
    running = account.get("opening_balance", 0.0)
    ledger = []
    for entry in entries:
        debit_amount = 0.0
        credit_amount = 0.0
        if entry["debit_account_id"] == account["id"]:
            debit_amount = entry["amount"]
            running += balance_delta(account["account_type"], "debit", entry["amount"])
        if entry["credit_account_id"] == account["id"]:
            credit_amount = entry["amount"]
            running += balance_delta(account["account_type"], "credit", entry["amount"])
        ledger.append({
            "journal_entry_id": entry["id"],
            "entry_number": entry["entry_number"],
            "entry_date": entry["entry_date"],
            "account_code": account["code"],
            "account_name": account["name"],
            "debit_amount": debit_amount,
            "credit_amount": credit_amount,
            "running_balance": round(running, 2),
            "description": entry["description"],
            "reference_number": entry.get("reference_number"),
        })
    return ledger


async def trial_balance(db, as_of_date: Optional[str] = None) -> dict:
    accounts = await db.accounts.find({"is_active": True}, {"_id": 0}).to_list(100)
    rows = []
    total_debits = 0.0
    total_credits = 0.0
    for account in accounts:
        balance = account.get("current_balance", 0.0)
        if as_of_date:
            ledger = await get_account_ledger(db, account["id"], to_date=as_of_date)
            balance = ledger[-1]["running_balance"] if ledger else account.get("opening_balance", 0.0)
        debit_bal = balance if account["account_type"] in DEBIT_NORMAL_TYPES and balance > 0 else 0.0
        credit_bal = abs(balance) if account["account_type"] not in DEBIT_NORMAL_TYPES and balance > 0 else 0.0
        if account["account_type"] in DEBIT_NORMAL_TYPES and balance < 0:
            credit_bal = abs(balance)
            debit_bal = 0.0
        elif account["account_type"] not in DEBIT_NORMAL_TYPES and balance < 0:
            debit_bal = abs(balance)
            credit_bal = 0.0
        total_debits += debit_bal
        total_credits += credit_bal
        rows.append({
            "account_id": account["id"],
            "code": account["code"],
            "name": account["name"],
            "account_type": account["account_type"],
            "debit_balance": round(debit_bal, 2),
            "credit_balance": round(credit_bal, 2),
        })
    return {
        "as_of_date": as_of_date,
        "accounts": rows,
        "total_debits": round(total_debits, 2),
        "total_credits": round(total_credits, 2),
        "balanced": abs(total_debits - total_credits) < 0.01,
    }


async def profit_loss(db, from_date: str, to_date: str) -> dict:
    income_accounts = await db.accounts.find({"account_type": "income"}, {"_id": 0}).to_list(50)
    expense_accounts = await db.accounts.find({"account_type": "expense"}, {"_id": 0}).to_list(50)

    async def period_total(account_id: str, account_type: str) -> float:
        query = {
            "$or": [{"debit_account_id": account_id}, {"credit_account_id": account_id}],
            "entry_date": {"$gte": from_date, "$lte": to_date},
            "status": {"$ne": "reversed"},
        }
        entries = await db.journal_entries.find(query, {"_id": 0}).to_list(10000)
        total = 0.0
        for entry in entries:
            if entry["debit_account_id"] == account_id:
                total += balance_delta(account_type, "debit", entry["amount"])
            if entry["credit_account_id"] == account_id:
                total += balance_delta(account_type, "credit", entry["amount"])
        return total

    income_lines = []
    expense_lines = []
    total_income = 0.0
    total_expenses = 0.0
    for acc in income_accounts:
        amt = await period_total(acc["id"], acc["account_type"])
        income_lines.append({"code": acc["code"], "name": acc["name"], "amount": round(amt, 2)})
        total_income += amt
    for acc in expense_accounts:
        amt = await period_total(acc["id"], acc["account_type"])
        expense_lines.append({"code": acc["code"], "name": acc["name"], "amount": round(amt, 2)})
        total_expenses += amt

    return {
        "from_date": from_date,
        "to_date": to_date,
        "income": income_lines,
        "expenses": expense_lines,
        "total_income": round(total_income, 2),
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(total_income - total_expenses, 2),
    }


async def balance_sheet(db, as_of_date: Optional[str] = None) -> dict:
    sections = {"asset": [], "liability": [], "equity": []}
    totals = {"assets": 0.0, "liabilities": 0.0, "equity": 0.0}
    for account_type, key in [("asset", "assets"), ("liability", "liabilities"), ("equity", "equity")]:
        accounts = await db.accounts.find({"account_type": account_type, "is_active": True}, {"_id": 0}).to_list(50)
        for acc in accounts:
            balance = acc.get("current_balance", 0.0)
            if as_of_date:
                ledger = await get_account_ledger(db, acc["id"], to_date=as_of_date)
                balance = ledger[-1]["running_balance"] if ledger else acc.get("opening_balance", 0.0)
            sections[account_type].append({"code": acc["code"], "name": acc["name"], "balance": round(balance, 2)})
            totals[key] += balance
    totals = {k: round(v, 2) for k, v in totals.items()}
    return {
        "as_of_date": as_of_date,
        "assets": sections["asset"],
        "liabilities": sections["liability"],
        "equity": sections["equity"],
        "total_assets": totals["assets"],
        "total_liabilities": totals["liabilities"],
        "total_equity": totals["equity"],
        "balanced": abs(totals["assets"] - (totals["liabilities"] + totals["equity"])) < 0.01,
    }


async def cash_flow(db, from_date: str, to_date: str) -> dict:
    cash_accounts = await db.accounts.find(
        {"category": "cash", "is_active": True},
        {"_id": 0},
    ).to_list(20)

    opening = sum(a.get("current_balance", 0.0) for a in cash_accounts)
    receipts = await db.client_receipts.find(
        {"payment_date": {"$gte": from_date, "$lte": to_date}},
        {"_id": 0},
    ).to_list(10000)
    receipt_total = sum(r.get("amount_usd", 0) for r in receipts)

    payments = await db.vendor_payments.find(
        {"payment_date": {"$gte": from_date, "$lte": to_date}},
        {"_id": 0},
    ).to_list(10000)
    payment_total = sum(p.get("amount_usd", 0) for p in payments)

    closing = opening
    return {
        "from_date": from_date,
        "to_date": to_date,
        "opening_cash_balance": round(opening, 2),
        "client_receipts": round(receipt_total, 2),
        "vendor_payments": round(payment_total, 2),
        "closing_cash_balance": round(closing + receipt_total - payment_total, 2),
    }


async def create_client_receipt(
    db,
    *,
    client_id: str,
    client_name: str,
    amount_usd: float,
    payment_date: str,
    payment_method: str,
    payment_reference: str,
    notes: Optional[str],
    received_by_user_id: str,
) -> dict:
    revenue_account = await db.accounts.find_one({"code": REVENUE_ACCOUNT_CODE}, {"_id": 0})
    if not revenue_account:
        raise HTTPException(status_code=400, detail="Chart of accounts not initialized")

    cash_account = await get_cash_account(db)
    je = await post_journal_entry(
        db,
        debit_account_id=cash_account["id"],
        credit_account_id=revenue_account["id"],
        amount=amount_usd,
        entry_type="client_payment",
        entry_date=payment_date,
        description=f"Payment from {client_name}",
        posted_by_user_id=received_by_user_id,
        related_entity_type="client",
        related_entity_id=client_id,
        reference_number=payment_reference,
    )

    receipt_number = await generate_entry_number(db, "REC")
    now = datetime.now(timezone.utc).isoformat()
    receipt = {
        "id": str(uuid.uuid4()),
        "receipt_number": receipt_number,
        "client_id": client_id,
        "client_name": client_name,
        "amount_usd": round(amount_usd, 2),
        "payment_date": payment_date,
        "payment_method": payment_method,
        "payment_reference": payment_reference,
        "cash_account_id": cash_account["id"],
        "status": "recorded",
        "notes": notes,
        "received_by_user_id": received_by_user_id,
        "received_at": now,
        "journal_entry_id": je["id"],
    }
    await db.client_receipts.insert_one(receipt)
    return receipt


async def create_vendor_payable(
    db,
    *,
    vendor_id: str,
    vendor_name: str,
    group_ids: List[str],
    unit_cost: float,
    quantity: int,
    due_date: str,
    notes: Optional[str],
    created_by_user_id: str,
) -> dict:
    total = round(unit_cost * quantity, 2)
    payable_number = await generate_entry_number(db, "PAY")
    now = datetime.now(timezone.utc).isoformat()
    payable = {
        "id": str(uuid.uuid4()),
        "payable_number": payable_number,
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "group_ids": group_ids,
        "total_passengers": quantity,
        "unit_cost": unit_cost,
        "quantity": quantity,
        "total_amount_usd": total,
        "status": "pending",
        "amount_paid": 0.0,
        "balance_due": total,
        "due_date": due_date,
        "first_payment_date": None,
        "last_payment_date": None,
        "vendor_bank_account": None,
        "notes": notes,
        "created_by_user_id": created_by_user_id,
        "created_at": now,
        "journal_entry_ids": [],
    }
    await db.vendor_payables.insert_one(payable)
    return payable


async def create_vendor_payment(
    db,
    *,
    vendor_id: str,
    vendor_name: str,
    amount_usd: float,
    payment_date: str,
    payment_method: str,
    payment_reference: str,
    notes: Optional[str],
    paid_by_user_id: str,
) -> dict:
    costs_account = await db.accounts.find_one({"code": VENDOR_COSTS_ACCOUNT_CODE}, {"_id": 0})
    if not costs_account:
        raise HTTPException(status_code=400, detail="Chart of accounts not initialized")

    cash_account = await get_cash_account(db)
    je = await post_journal_entry(
        db,
        debit_account_id=costs_account["id"],
        credit_account_id=cash_account["id"],
        amount=amount_usd,
        entry_type="vendor_payment",
        entry_date=payment_date,
        description=f"Payment to {vendor_name}",
        posted_by_user_id=paid_by_user_id,
        related_entity_type="vendor",
        related_entity_id=vendor_id,
        reference_number=payment_reference,
    )

    payment_number = await generate_entry_number(db, "VPAY")
    now = datetime.now(timezone.utc).isoformat()
    payment = {
        "id": str(uuid.uuid4()),
        "payment_number": payment_number,
        "vendor_id": vendor_id,
        "vendor_name": vendor_name,
        "amount_usd": round(amount_usd, 2),
        "payment_date": payment_date,
        "payment_method": payment_method,
        "payment_reference": payment_reference,
        "cash_account_id": cash_account["id"],
        "notes": notes,
        "paid_by_user_id": paid_by_user_id,
        "paid_at": now,
        "journal_entry_id": je["id"],
    }
    await db.vendor_payments.insert_one(payment)
    return payment


async def create_payable_for_vendor_assignment(
    db,
    *,
    vendor_id: str,
    group_id: str,
    unit_cost: float,
    quantity: int,
    created_by_user_id: str,
) -> Optional[dict]:
    existing = await db.vendor_payables.find_one({"group_ids": group_id, "vendor_id": vendor_id})
    if existing:
        return existing
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        return None
    due_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await create_vendor_payable(
        db,
        vendor_id=vendor_id,
        vendor_name=vendor.get("name", "Unknown"),
        group_ids=[group_id],
        unit_cost=unit_cost,
        quantity=quantity,
        due_date=due_date,
        notes=f"Auto-created on vendor assignment for group {group_id}",
        created_by_user_id=created_by_user_id,
    )


async def get_group_financial_summary(db, group_id: str) -> dict:
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    client = await db.clients.find_one({"id": group.get("client_id")}, {"_id": 0}) or {}
    passport_count = await db.passports.count_documents({"group_id": group_id})
    passenger_count = group.get("passenger_count") or passport_count or 0
    pricing = pricing_breakdown(group, client, passenger_count)

    payables = await db.vendor_payables.find({"group_ids": group_id}, {"_id": 0}).to_list(100)
    expected_vendor_cost = sum(p.get("total_amount_usd", 0) for p in payables)

    return {
        "group_id": group_id,
        "suggested_revenue": pricing["suggested_revenue"],
        "base_price_per_passport": pricing["base_price_per_passport"],
        "rush_fee": pricing["rush_fee"],
        "client_base_price_per_passport": pricing["client_base_price_per_passport"],
        "client_rush_fee": pricing["client_rush_fee"],
        "is_custom_pricing": pricing["is_custom_pricing"],
        "passenger_count": pricing["passenger_count"],
        "expected_vendor_cost": round(expected_vendor_cost, 2),
    }


async def update_group_pricing(
    db,
    group_id: str,
    base_price_per_passport: Optional[float] = None,
    rush_fee: Optional[float] = None,
) -> dict:
    group = await db.groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    update: Dict[str, float] = {}
    if base_price_per_passport is not None:
        if base_price_per_passport < 0:
            raise HTTPException(status_code=400, detail="base_price_per_passport must be non-negative")
        update["base_price_per_passport"] = base_price_per_passport
    if rush_fee is not None:
        if rush_fee < 0:
            raise HTTPException(status_code=400, detail="rush_fee must be non-negative")
        update["rush_fee"] = rush_fee
    if not update:
        raise HTTPException(status_code=400, detail="No pricing fields to update")

    await db.groups.update_one({"id": group_id}, {"$set": update})
    return await get_group_financial_summary(db, group_id)


async def get_client_ledger(db, client_id: str) -> dict:
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    groups_raw = await db.groups.find(
        {"client_id": client_id, "status": {"$ne": DEFAULT_STATUS}},
        {"_id": 0},
    ).sort("departure_date", -1).to_list(500)

    receipts = await db.client_receipts.find({"client_id": client_id}, {"_id": 0}).sort(
        "payment_date", -1
    ).to_list(1000)

    user_names = {}
    receipt_rows = []
    for r in receipts:
        uid = r.get("received_by_user_id")
        if uid and uid not in user_names:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
            user_names[uid] = u.get("name", "Unknown") if u else "Unknown"
        receipt_rows.append({
            "id": r.get("id"),
            "receipt_number": r.get("receipt_number"),
            "payment_date": r.get("payment_date"),
            "amount_usd": r.get("amount_usd"),
            "payment_method": r.get("payment_method"),
            "payment_reference": r.get("payment_reference"),
            "status": r.get("status"),
            "recorded_by": user_names.get(uid, "Unknown") if uid else "Unknown",
        })

    groups_out = []
    total_passengers = 0
    total_billed = 0.0

    for group in groups_raw:
        gid = group.get("id")
        passport_count = await db.passports.count_documents({"group_id": gid})
        passenger_count = group.get("passenger_count") or passport_count or 0
        pricing = pricing_breakdown(group, client, passenger_count)
        suggested = pricing["suggested_revenue"]
        submitted_at = None
        hist_cursor = db.status_history.find(
            {"group_id": gid, "new_status": SUBMITTED_STATUS},
            {"_id": 0},
        ).sort("timestamp", 1).limit(1)
        hist_list = await hist_cursor.to_list(1)
        if hist_list:
            submitted_at = hist_list[0].get("timestamp")

        groups_out.append({
            "group_id": gid,
            "name": group.get("name"),
            "status": group.get("status"),
            "passenger_count": passenger_count,
            "base_price_per_passport": pricing["base_price_per_passport"],
            "rush_fee": pricing["rush_fee"],
            "is_custom_pricing": pricing["is_custom_pricing"],
            "suggested_amount": suggested,
            "submitted_at": submitted_at,
            "billing_date": _date_only(submitted_at or group.get("departure_date")),
        })
        total_passengers += passenger_count
        total_billed += suggested

    total_paid = round(sum(r.get("amount_usd", 0) for r in receipts), 2)

    charge_lines = []
    for g in groups_out:
        if g.get("suggested_amount", 0) <= 0:
            continue
        name = g.get("name") or g.get("group_id")
        charge_lines.append({
            "date": g.get("billing_date"),
            "particulars": f"Billing — {name} ({g.get('passenger_count', 0)} passengers)",
            "reference": g.get("group_id", ""),
            "debit": g.get("suggested_amount", 0),
        })
    payment_lines = [
        {
            "date": r.get("payment_date"),
            "particulars": f"Receipt {r.get('receipt_number', '')}",
            "reference": r.get("payment_reference", ""),
            "credit": r.get("amount_usd", 0),
        }
        for r in receipts
    ]
    statement = build_party_statement(charge_lines, payment_lines)

    return {
        "client_id": client_id,
        "client_name": client.get("name", "Unknown"),
        "summary": {
            "groups_submitted": len(groups_out),
            "total_passengers": total_passengers,
            "total_billed": round(total_billed, 2),
            "total_paid": total_paid,
            "balance_due": round(max(total_billed - total_paid, 0), 2),
        },
        "groups": groups_out,
        "receipts": receipt_rows,
        "statement": statement,
    }


async def _compute_vendor_ledger_summary(db, vendor_id: str) -> dict:
    payables = await db.vendor_payables.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)
    payments = await db.vendor_payments.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)

    total_visas = sum(p.get("total_passengers", 0) or p.get("quantity", 0) for p in payables)
    total_owed = sum(p.get("total_amount_usd", 0) for p in payables)
    total_paid = sum(p.get("amount_usd", 0) for p in payments)

    return {
        "groups_assigned": len(payables),
        "total_visas_processed": int(total_visas),
        "total_owed": round(total_owed, 2),
        "total_paid": round(total_paid, 2),
        "balance_due": round(max(total_owed - total_paid, 0), 2),
    }


async def list_vendor_ledgers(db, vendor_ids: Optional[List[str]] = None) -> List[dict]:
    query = {}
    if vendor_ids:
        query["id"] = {"$in": vendor_ids}
    vendors = await db.vendors.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    rows = []
    for vendor in vendors:
        vid = vendor.get("id")
        summary = await _compute_vendor_ledger_summary(db, vid)
        rows.append({
            "vendor_id": vid,
            "vendor_name": vendor.get("name", "Unknown"),
            **summary,
        })
    return rows


async def list_client_ledgers(db) -> List[dict]:
    clients = await db.clients.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    rows = []
    for client in clients:
        cid = client.get("id")
        ledger = await get_client_ledger(db, cid)
        summary = ledger.get("summary", {})
        rows.append({
            "client_id": cid,
            "client_name": client.get("name", "Unknown"),
            "groups_submitted": summary.get("groups_submitted", 0),
            "total_passengers": summary.get("total_passengers", 0),
            "total_billed": summary.get("total_billed", 0),
            "total_paid": summary.get("total_paid", 0),
            "balance_due": summary.get("balance_due", 0),
        })
    return rows


async def get_vendor_ledger(db, vendor_id: str) -> dict:
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    payables = await db.vendor_payables.find({"vendor_id": vendor_id}, {"_id": 0}).sort(
        "due_date", -1
    ).to_list(1000)

    payments = await db.vendor_payments.find({"vendor_id": vendor_id}, {"_id": 0}).sort(
        "payment_date", -1
    ).to_list(1000)

    user_names = {}
    payment_rows = []
    for p in payments:
        uid = p.get("paid_by_user_id")
        if uid and uid not in user_names:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "name": 1})
            user_names[uid] = u.get("name", "Unknown") if u else "Unknown"
        payment_rows.append({
            "id": p.get("id"),
            "payment_number": p.get("payment_number"),
            "payment_date": p.get("payment_date"),
            "amount_usd": p.get("amount_usd"),
            "payment_method": p.get("payment_method"),
            "payment_reference": p.get("payment_reference"),
            "recorded_by": user_names.get(uid, "Unknown") if uid else "Unknown",
        })

    groups_out = []
    total_visas = 0
    for payable in payables:
        passenger_count = payable.get("total_passengers", 0) or payable.get("quantity", 0)
        unit_cost = payable.get("unit_cost", 0)
        for gid in payable.get("group_ids") or []:
            group = await db.groups.find_one({"id": gid}, {"_id": 0, "name": 1, "status": 1})
            groups_out.append({
                "group_id": gid,
                "name": group.get("name") if group else gid,
                "status": group.get("status") if group else None,
                "passenger_count": passenger_count,
                "unit_cost": unit_cost,
                "expected_cost": payable.get("total_amount_usd", 0),
                "payable_number": payable.get("payable_number"),
            })
        total_visas += passenger_count

    summary = await _compute_vendor_ledger_summary(db, vendor_id)

    charge_lines = []
    for payable in payables:
        passenger_count = payable.get("total_passengers", 0) or payable.get("quantity", 0)
        unit_cost = payable.get("unit_cost", 0)
        group_label = ", ".join(payable.get("group_ids") or [])
        charge_lines.append({
            "date": payable.get("created_at") or payable.get("due_date"),
            "particulars": (
                f"Visa processing — {passenger_count} visas @ ${unit_cost:.2f}"
                + (f" ({group_label})" if group_label else "")
            ),
            "reference": payable.get("payable_number", ""),
            "debit": payable.get("total_amount_usd", 0),
        })
    payment_lines = [
        {
            "date": p.get("payment_date"),
            "particulars": f"Payment {p.get('payment_number', '')}",
            "reference": p.get("payment_reference", ""),
            "credit": p.get("amount_usd", 0),
        }
        for p in payments
    ]
    statement = build_party_statement(charge_lines, payment_lines)

    return {
        "vendor_id": vendor_id,
        "vendor_name": vendor.get("name", "Unknown"),
        "summary": {
            "groups_assigned": summary["groups_assigned"],
            "total_visas_processed": summary["total_visas_processed"],
            "total_owed": summary["total_owed"],
            "total_paid": summary["total_paid"],
            "balance_due": summary["balance_due"],
        },
        "groups": groups_out,
        "payments": payment_rows,
        "statement": statement,
    }


def _passport_display_name(passport: dict) -> str:
    first = (passport.get("first_name_en") or "").strip()
    surname = (passport.get("surname_en") or "").strip()
    if first or surname:
        return f"{first} {surname}".strip()
    first_ar = (passport.get("first_name_ar") or "").strip()
    surname_ar = (passport.get("surname_ar") or "").strip()
    if first_ar or surname_ar:
        return f"{first_ar} {surname_ar}".strip()
    return "—"


async def _group_submission_date(db, group_id: str, group: dict) -> str:
    hist_cursor = db.status_history.find(
        {"group_id": group_id, "new_status": SUBMITTED_STATUS},
        {"_id": 0},
    ).sort("timestamp", 1).limit(1)
    hist_list = await hist_cursor.to_list(1)
    if hist_list:
        return _date_only(hist_list[0].get("timestamp"))
    return _date_only(group.get("departure_date"))


async def _build_client_visa_charge_lines(db, client_id: str) -> List[dict]:
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        return []

    groups = await db.groups.find(
        {"client_id": client_id, "status": {"$ne": DEFAULT_STATUS}},
        {"_id": 0},
    ).to_list(500)

    lines: List[dict] = []
    for group in groups:
        gid = group.get("id")
        billing_date = await _group_submission_date(db, gid, group)
        base, rush = resolve_group_pricing(group, client)
        passports = await db.passports.find({"group_id": gid}, {"_id": 0}).sort(
            "passport_no", 1
        ).to_list(500)
        group_name = group.get("name") or gid

        for passport in passports:
            lines.append({
                "line_type": "visa",
                "date": billing_date,
                "group_id": gid,
                "pax_name": _passport_display_name(passport),
                "passport_no": passport.get("passport_no", ""),
                "rate": round(base, 2),
                "debit": round(base, 2),
                "credit": 0.0,
                "particulars": f"Visa — {group_name}",
                "reference": passport.get("passport_no", ""),
                "sort_order": 0,
            })

        planned = group.get("passenger_count")
        actual = len(passports)
        if planned and planned > actual:
            diff = planned - actual
            lines.append({
                "line_type": "adjustment",
                "date": billing_date,
                "group_id": gid,
                "pax_name": f"Passenger count adjustment ({diff} pax)",
                "passport_no": "",
                "rate": round(base, 2),
                "debit": round(diff * base, 2),
                "credit": 0.0,
                "particulars": f"Billing adjustment — {group_name}",
                "reference": f"{gid}-adj",
                "sort_order": 0,
            })
        elif not passports and planned:
            for i in range(planned):
                lines.append({
                    "line_type": "visa",
                    "date": billing_date,
                    "group_id": gid,
                    "pax_name": f"Passenger {i + 1}",
                    "passport_no": "",
                    "rate": round(base, 2),
                    "debit": round(base, 2),
                    "credit": 0.0,
                    "particulars": f"Visa — {group_name}",
                    "reference": f"{gid}-p{i + 1}",
                    "sort_order": 0,
                })

        if rush > 0:
            lines.append({
                "line_type": "rush_fee",
                "date": billing_date,
                "group_id": gid,
                "pax_name": "",
                "passport_no": "",
                "rate": round(rush, 2),
                "debit": round(rush, 2),
                "credit": 0.0,
                "particulars": f"Rush fee — {group_name}",
                "reference": f"{gid}-rush",
                "sort_order": 0,
            })

    return lines


async def _build_vendor_visa_charge_lines(db, vendor_id: str) -> List[dict]:
    payables = await db.vendor_payables.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)
    lines: List[dict] = []

    for payable in payables:
        unit_cost = float(payable.get("unit_cost", 0))
        for gid in payable.get("group_ids") or []:
            group = await db.groups.find_one({"id": gid}, {"_id": 0})
            billing_date = _date_only(
                group.get("assigned_at") if group else None,
                _date_only(payable.get("created_at")),
            )
            group_name = (group.get("name") if group else None) or gid
            passports = await db.passports.find({"group_id": gid}, {"_id": 0}).sort(
                "passport_no", 1
            ).to_list(500)

            if passports:
                for passport in passports:
                    lines.append({
                        "line_type": "visa",
                        "date": billing_date,
                        "group_id": gid,
                        "pax_name": _passport_display_name(passport),
                        "passport_no": passport.get("passport_no", ""),
                        "rate": round(unit_cost, 2),
                        "debit": round(unit_cost, 2),
                        "credit": 0.0,
                        "particulars": f"Visa processing — {group_name}",
                        "reference": passport.get("passport_no", ""),
                        "sort_order": 0,
                    })
            else:
                qty = payable.get("total_passengers", 0) or payable.get("quantity", 0)
                for i in range(int(qty)):
                    lines.append({
                        "line_type": "visa",
                        "date": billing_date,
                        "group_id": gid,
                        "pax_name": f"Passenger {i + 1}",
                        "passport_no": "",
                        "rate": round(unit_cost, 2),
                        "debit": round(unit_cost, 2),
                        "credit": 0.0,
                        "particulars": f"Visa processing — {group_name}",
                        "reference": f"{gid}-p{i + 1}",
                        "sort_order": 0,
                    })

    return lines


async def _build_client_payment_lines(db, client_id: str) -> List[dict]:
    receipts = await db.client_receipts.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
    return [
        {
            "line_type": "payment",
            "date": _date_only(r.get("payment_date")),
            "group_id": "",
            "pax_name": "",
            "passport_no": "",
            "rate": None,
            "debit": 0.0,
            "credit": round(float(r.get("amount_usd", 0)), 2),
            "particulars": f"Receipt {r.get('receipt_number', '')}",
            "reference": r.get("payment_reference", r.get("receipt_number", "")),
            "sort_order": 1,
            "payment_number": r.get("receipt_number"),
            "payment_method": r.get("payment_method"),
        }
        for r in receipts
    ]


async def _build_vendor_payment_lines(db, vendor_id: str) -> List[dict]:
    payments = await db.vendor_payments.find({"vendor_id": vendor_id}, {"_id": 0}).to_list(1000)
    return [
        {
            "line_type": "payment",
            "date": _date_only(p.get("payment_date")),
            "group_id": "",
            "pax_name": "",
            "passport_no": "",
            "rate": None,
            "debit": 0.0,
            "credit": round(float(p.get("amount_usd", 0)), 2),
            "particulars": f"Payment {p.get('payment_number', '')}",
            "reference": p.get("payment_reference", p.get("payment_number", "")),
            "sort_order": 1,
            "payment_number": p.get("payment_number"),
            "payment_method": p.get("payment_method"),
        }
        for p in payments
    ]


def _assemble_visa_statement(
    all_rows: List[dict],
    from_date: str,
    to_date: str,
    party_type: str,
    party_id: str,
    party_name: str,
) -> dict:
    opening = 0.0
    for row in all_rows:
        if row["date"] < from_date:
            opening = round(opening + row.get("debit", 0) - row.get("credit", 0), 2)

    period_rows = [r for r in all_rows if from_date <= r["date"] <= to_date]
    period_rows.sort(key=lambda r: (r["date"], r.get("sort_order", 0), r.get("reference", "")))

    lines: List[dict] = []
    balance = opening
    sr_no = 0

    if opening != 0:
        sr_no += 1
        lines.append({
            "sr_no": sr_no,
            "line_type": "opening",
            "date": from_date,
            "group_id": "",
            "pax_name": "",
            "passport_no": "",
            "rate": None,
            "debit": None,
            "credit": None,
            "particulars": "Opening Balance",
            "running_balance": abs(opening),
            "balance_side": "Dr" if opening >= 0 else "Cr",
        })

    visas_in_period = 0
    total_charges = 0.0
    total_payments = 0.0

    for row in period_rows:
        balance = round(balance + row.get("debit", 0) - row.get("credit", 0), 2)
        sr_no += 1
        if row.get("line_type") == "visa":
            visas_in_period += 1
        if row.get("debit", 0) > 0:
            total_charges = round(total_charges + row["debit"], 2)
        if row.get("credit", 0) > 0:
            total_payments = round(total_payments + row["credit"], 2)

        lines.append({
            "sr_no": sr_no,
            "line_type": row.get("line_type"),
            "date": row["date"],
            "group_id": row.get("group_id", ""),
            "pax_name": row.get("pax_name", ""),
            "passport_no": row.get("passport_no", ""),
            "rate": row.get("rate"),
            "debit": row["debit"] if row.get("debit") else None,
            "credit": row["credit"] if row.get("credit") else None,
            "particulars": row.get("particulars", ""),
            "running_balance": abs(balance),
            "balance_side": "Dr" if balance >= 0 else "Cr",
        })

    period_payments = [
        {
            "date": r["date"],
            "payment_number": r.get("payment_number", ""),
            "particulars": r.get("particulars", ""),
            "reference": r.get("reference", ""),
            "amount_usd": r.get("credit", 0),
            "payment_method": r.get("payment_method", ""),
        }
        for r in period_rows
        if r.get("line_type") == "payment"
    ]

    return {
        "party_type": party_type,
        "party_id": party_id,
        "party_name": party_name,
        "period": {"from_date": from_date, "to_date": to_date},
        "opening_balance": {
            "amount": abs(opening),
            "side": "Dr" if opening >= 0 else "Cr",
        },
        "lines": lines,
        "period_payments": period_payments,
        "summary": {
            "visas_in_period": visas_in_period,
            "total_charges": total_charges,
            "total_payments": total_payments,
            "closing_balance": abs(balance),
            "closing_side": "Dr" if balance >= 0 else "Cr",
        },
    }


async def build_client_visa_statement(db, client_id: str, from_date: str, to_date: str) -> dict:
    client = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    charge_lines = await _build_client_visa_charge_lines(db, client_id)
    payment_lines = await _build_client_payment_lines(db, client_id)
    all_rows = charge_lines + payment_lines
    return _assemble_visa_statement(
        all_rows, from_date, to_date, "client", client_id, client.get("name", "Unknown")
    )


async def build_vendor_visa_statement(db, vendor_id: str, from_date: str, to_date: str) -> dict:
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    charge_lines = await _build_vendor_visa_charge_lines(db, vendor_id)
    payment_lines = await _build_vendor_payment_lines(db, vendor_id)
    all_rows = charge_lines + payment_lines
    return _assemble_visa_statement(
        all_rows, from_date, to_date, "vendor", vendor_id, vendor.get("name", "Unknown")
    )


def visa_statement_to_csv(statement: dict) -> str:
    import csv
    import io

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Sr No", "Date", "Group ID", "Pax Name", "Passport No",
        "Rate", "Debit", "Credit", "Running Balance", "Balance Side", "Particulars",
    ])
    for line in statement.get("lines", []):
        writer.writerow([
            line.get("sr_no", ""),
            line.get("date", ""),
            line.get("group_id", ""),
            line.get("pax_name", ""),
            line.get("passport_no", ""),
            f"{line['rate']:.2f}" if line.get("rate") is not None else "",
            f"{line['debit']:.2f}" if line.get("debit") is not None else "",
            f"{line['credit']:.2f}" if line.get("credit") is not None else "",
            f"{line.get('running_balance', 0):.2f}",
            line.get("balance_side", ""),
            line.get("particulars", ""),
        ])
    return output.getvalue()


async def accounting_dashboard(db) -> dict:
    cash_accounts = await db.accounts.find(
        {"category": "cash", "is_active": True},
        {"_id": 0},
    ).to_list(20)
    revenue = await db.accounts.find_one({"code": REVENUE_ACCOUNT_CODE}, {"_id": 0})
    costs = await db.accounts.find_one({"code": VENDOR_COSTS_ACCOUNT_CODE}, {"_id": 0})
    cash_balance = sum(a.get("current_balance", 0) for a in cash_accounts)
    total_revenue = revenue.get("current_balance", 0) if revenue else 0
    total_costs = costs.get("current_balance", 0) if costs else 0
    vendor_summaries = await list_vendor_ledgers(db)
    total_vendor_balance_due = round(sum(v.get("balance_due", 0) for v in vendor_summaries), 2)
    return {
        "cash_balance": round(cash_balance, 2),
        "total_revenue": round(total_revenue, 2),
        "total_costs": round(total_costs, 2),
        "net_profit": round(total_revenue - total_costs, 2),
        "total_vendor_balance_due": total_vendor_balance_due,
    }
