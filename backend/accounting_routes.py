"""Ledger accounting API routes."""

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader
from pydantic import BaseModel

from permissions import (
    require_permission,
    check_permission,
    require_global_accounting_access,
    require_client_ledger_access,
    require_vendor_ledger_access,
    normalize_role,
    can_access_client_financial,
    can_access_vendor_financial,
    can_access_group,
)
import accounting as acct

TEMPLATE_DIR = Path(__file__).parent / "templates"
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


def _resolve_client_id_for_ledger(current_user: dict, client_id: Optional[str]) -> str:
    role = normalize_role(current_user.get("role"))
    if check_permission(current_user, "can_view_client_ledger"):
        target = current_user.get("client_id")
        if not target:
            raise HTTPException(status_code=400, detail="User has no client assigned")
        return target
    if role in ("system_admin", "system_accounts"):
        if not client_id:
            raise HTTPException(status_code=400, detail="client_id query parameter required")
        return client_id
    raise HTTPException(status_code=403, detail="Permission denied: can_view_client_ledger")


def _resolve_vendor_id_for_ledger(current_user: dict, vendor_id: Optional[str]) -> str:
    role = normalize_role(current_user.get("role"))
    if check_permission(current_user, "can_view_vendor_ledger") and role == "vendor_accounts":
        target = current_user.get("vendor_id")
        if not target:
            raise HTTPException(status_code=400, detail="User has no vendor assigned")
        return target
    if role in ("system_admin", "system_accounts"):
        if not vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id query parameter required")
        return vendor_id
    raise HTTPException(status_code=403, detail="Permission denied: can_view_vendor_ledger")


def _visa_statement_pdf_bytes(statement: dict) -> bytes:
    template = jinja_env.get_template("visa_statement.html")
    party_type_label = "Client" if statement.get("party_type") == "client" else "Vendor"
    opening = statement.get("opening_balance", {})
    html = template.render(
        party_name=statement.get("party_name", ""),
        party_type_label=party_type_label,
        from_date=statement.get("period", {}).get("from_date", ""),
        to_date=statement.get("period", {}).get("to_date", ""),
        opening_amount=f"{opening.get('amount', 0):.2f}",
        opening_side=opening.get("side", "Dr"),
        lines=statement.get("lines", []),
        period_payments=statement.get("period_payments", []),
        summary=statement.get("summary", {}),
    )
    from weasyprint import HTML
    pdf_buffer = io.BytesIO()
    HTML(string=html).write_pdf(pdf_buffer)
    return pdf_buffer.getvalue()


class JournalEntryCreate(BaseModel):
    entry_type: str
    debit_account_id: str
    credit_account_id: str
    amount: float
    entry_date: str
    description: str
    reference_number: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[str] = None


class JournalEntryReverse(BaseModel):
    reason: str


class AccountUpdate(BaseModel):
    opening_balance: Optional[float] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ClientReceiptCreate(BaseModel):
    client_id: str
    amount_usd: float
    payment_date: str
    payment_method: str
    payment_reference: str
    notes: Optional[str] = None


class GroupPricingUpdate(BaseModel):
    base_price_per_passport: Optional[float] = None
    rush_fee: Optional[float] = None


class VendorPayableCreate(BaseModel):
    vendor_id: str
    group_ids: List[str]
    unit_cost: float
    quantity: int
    due_date: str
    notes: Optional[str] = None


class VendorPaymentRecordCreate(BaseModel):
    vendor_id: str
    amount_usd: float
    payment_date: str
    payment_method: str
    payment_reference: str
    notes: Optional[str] = None


def register_accounting_routes(api_router, db, get_current_user):
    """Register ledger accounting endpoints."""

    def require_financial_access(user):
        require_permission(user, "can_access_financial")

    def require_receipt_list_access(user):
        require_global_accounting_access(user)

    def require_payable_list_access(user):
        role = normalize_role(user.get("role"))
        if check_permission(user, "can_view_global_accounting"):
            return
        if role == "vendor_accounts":
            return
        raise HTTPException(status_code=403, detail="Permission denied: can_view_global_accounting")

    @api_router.post("/accounting/initialize")
    async def initialize_chart(current_user: dict = Depends(get_current_user)):
        require_permission(current_user, "can_initialize_accounts")
        return await acct.initialize_chart_of_accounts(db)

    @api_router.get("/accounting/accounts")
    async def list_accounts(
        account_type: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        query = {"is_active": True, "code": {"$nin": list(acct.HIDDEN_COA_CODES)}}
        if account_type:
            query["account_type"] = account_type
        return await db.accounts.find(query, {"_id": 0}).sort("code", 1).to_list(100)

    @api_router.get("/accounting/accounts/{account_id}")
    async def get_account(account_id: str, current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        return await acct.get_account_by_id(db, account_id)

    @api_router.put("/accounting/accounts/{account_id}")
    async def update_account(
        account_id: str,
        body: AccountUpdate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_initialize_accounts")
        account = await acct.get_account_by_id(db, account_id)
        update = {k: v for k, v in body.model_dump().items() if v is not None}
        if "opening_balance" in update:
            delta = update["opening_balance"] - account.get("opening_balance", 0)
            update["current_balance"] = account.get("current_balance", 0) + delta
            update["last_updated"] = datetime.now(timezone.utc).isoformat()
        if not update:
            return account
        await db.accounts.update_one({"id": account["id"]}, {"$set": update})
        return await db.accounts.find_one({"id": account["id"]}, {"_id": 0})

    @api_router.post("/accounting/journal-entries")
    async def create_journal_entry(
        body: JournalEntryCreate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_post_journal_entries")
        return await acct.post_journal_entry(
            db,
            debit_account_id=body.debit_account_id,
            credit_account_id=body.credit_account_id,
            amount=body.amount,
            entry_type=body.entry_type,
            entry_date=body.entry_date,
            description=body.description,
            posted_by_user_id=current_user["id"],
            related_entity_type=body.related_entity_type,
            related_entity_id=body.related_entity_id,
            reference_number=body.reference_number,
        )

    @api_router.get("/accounting/journal-entries")
    async def list_journal_entries(
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        account_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        query = {"status": {"$ne": "reversed"}}
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["entry_date"] = date_filter
        if entry_type:
            query["entry_type"] = entry_type
        if account_id:
            acc = await acct.get_account_by_id(db, account_id)
            query["$or"] = [{"debit_account_id": acc["id"]}, {"credit_account_id": acc["id"]}]
        return await db.journal_entries.find(query, {"_id": 0}).sort("entry_date", -1).to_list(1000)

    @api_router.get("/accounting/journal-entries/{entry_id}")
    async def get_journal_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        entry = await db.journal_entries.find_one({"id": entry_id}, {"_id": 0})
        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        return entry

    @api_router.post("/accounting/journal-entries/{entry_id}/reverse")
    async def reverse_entry(
        entry_id: str,
        body: JournalEntryReverse,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_post_journal_entries")
        return await acct.reverse_journal_entry(db, entry_id, body.reason, current_user["id"])

    @api_router.post("/accounting/client-receipts")
    async def create_client_receipt(
        body: ClientReceiptCreate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_record_receipts")
        client = await db.clients.find_one({"id": body.client_id}, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        if not can_access_client_financial(current_user, body.client_id):
            raise HTTPException(status_code=403, detail="Access denied to this client")
        return await acct.create_client_receipt(
            db,
            client_id=body.client_id,
            client_name=client.get("name", "Unknown"),
            amount_usd=body.amount_usd,
            payment_date=body.payment_date,
            payment_method=body.payment_method,
            payment_reference=body.payment_reference,
            notes=body.notes,
            received_by_user_id=current_user["id"],
        )

    @api_router.get("/accounting/client-receipts")
    async def list_client_receipts(
        client_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_receipt_list_access(current_user)
        query = {}
        if client_id:
            if not can_access_client_financial(current_user, client_id):
                raise HTTPException(status_code=403, detail="Access denied")
            query["client_id"] = client_id
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["payment_date"] = date_filter
        return await db.client_receipts.find(query, {"_id": 0}).sort("payment_date", -1).to_list(1000)

    @api_router.get("/accounting/client-receipts/{receipt_id}")
    async def get_client_receipt(receipt_id: str, current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        receipt = await db.client_receipts.find_one({"id": receipt_id}, {"_id": 0})
        if not receipt:
            raise HTTPException(status_code=404, detail="Receipt not found")
        if not can_access_client_financial(current_user, receipt.get("client_id")):
            raise HTTPException(status_code=403, detail="Access denied")
        return receipt

    @api_router.post("/accounting/vendor-payables")
    async def create_vendor_payable(
        body: VendorPayableCreate,
        current_user: dict = Depends(get_current_user),
    ):
        role = normalize_role(current_user.get("role"))
        if role not in ("system_admin", "system_staff"):
            raise HTTPException(status_code=403, detail="Staff access required")
        vendor = await db.vendors.find_one({"id": body.vendor_id}, {"_id": 0})
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        return await acct.create_vendor_payable(
            db,
            vendor_id=body.vendor_id,
            vendor_name=vendor.get("name", "Unknown"),
            group_ids=body.group_ids,
            unit_cost=body.unit_cost,
            quantity=body.quantity,
            due_date=body.due_date,
            notes=body.notes,
            created_by_user_id=current_user["id"],
        )

    @api_router.get("/accounting/vendor-payables")
    async def list_vendor_payables(
        vendor_id: Optional[str] = None,
        group_id: Optional[str] = None,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_payable_list_access(current_user)
        query = {}
        role = normalize_role(current_user.get("role"))
        if role == "vendor_accounts":
            query["vendor_id"] = current_user.get("vendor_id")
        elif vendor_id:
            if not can_access_vendor_financial(current_user, vendor_id):
                raise HTTPException(status_code=403, detail="Access denied")
            query["vendor_id"] = vendor_id
        if group_id:
            query["group_ids"] = group_id
        if status:
            query["status"] = status
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["due_date"] = date_filter
        return await db.vendor_payables.find(query, {"_id": 0}).sort("due_date", -1).to_list(1000)

    @api_router.get("/accounting/vendor-payables/{payable_id}")
    async def get_vendor_payable(payable_id: str, current_user: dict = Depends(get_current_user)):
        role = normalize_role(current_user.get("role"))
        if not check_permission(current_user, "can_view_global_accounting") and role != "vendor_accounts":
            raise HTTPException(status_code=403, detail="Permission denied: can_view_global_accounting")
        payable = await db.vendor_payables.find_one({"id": payable_id}, {"_id": 0})
        if not payable:
            raise HTTPException(status_code=404, detail="Payable not found")
        if not can_access_vendor_financial(current_user, payable.get("vendor_id")):
            if normalize_role(current_user.get("role")) not in ("system_admin", "system_staff", "system_accounts"):
                raise HTTPException(status_code=403, detail="Access denied")
        return payable

    @api_router.post("/accounting/vendor-payments")
    async def create_vendor_payment(
        body: VendorPaymentRecordCreate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_manage_financial")
        vendor = await db.vendors.find_one({"id": body.vendor_id}, {"_id": 0})
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        if not can_access_vendor_financial(current_user, body.vendor_id):
            raise HTTPException(status_code=403, detail="Access denied to this vendor")
        return await acct.create_vendor_payment(
            db,
            vendor_id=body.vendor_id,
            vendor_name=vendor.get("name", "Unknown"),
            amount_usd=body.amount_usd,
            payment_date=body.payment_date,
            payment_method=body.payment_method,
            payment_reference=body.payment_reference,
            notes=body.notes,
            paid_by_user_id=current_user["id"],
        )

    def require_vendor_payment_list_access(user):
        role = normalize_role(user.get("role"))
        if check_permission(user, "can_view_global_accounting"):
            return
        if role == "vendor_accounts":
            return
        raise HTTPException(status_code=403, detail="Permission denied: can_view_global_accounting")

    @api_router.get("/accounting/vendor-payments")
    async def list_vendor_payments(
        vendor_id: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_vendor_payment_list_access(current_user)
        query = {}
        role = normalize_role(current_user.get("role"))
        if role == "vendor_accounts":
            query["vendor_id"] = current_user.get("vendor_id")
        elif vendor_id:
            if not can_access_vendor_financial(current_user, vendor_id):
                raise HTTPException(status_code=403, detail="Access denied")
            query["vendor_id"] = vendor_id
        if from_date or to_date:
            date_filter = {}
            if from_date:
                date_filter["$gte"] = from_date
            if to_date:
                date_filter["$lte"] = to_date
            query["payment_date"] = date_filter
        return await db.vendor_payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(1000)

    @api_router.get("/accounting/vendor-payments/{payment_id}")
    async def get_vendor_payment(payment_id: str, current_user: dict = Depends(get_current_user)):
        require_vendor_payment_list_access(current_user)
        payment = await db.vendor_payments.find_one({"id": payment_id}, {"_id": 0})
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        if not can_access_vendor_financial(current_user, payment.get("vendor_id")):
            if normalize_role(current_user.get("role")) not in ("system_admin", "system_staff", "system_accounts"):
                raise HTTPException(status_code=403, detail="Access denied")
        return payment

    @api_router.get("/accounting/ledger/{account_id}")
    async def get_account_ledger(
        account_id: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        ledger = await acct.get_account_ledger(db, account_id, from_date, to_date)
        account = await acct.get_account_by_id(db, account_id)
        return {"account": account, "entries": ledger}

    @api_router.get("/accounting/trial-balance")
    async def trial_balance(
        as_of_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        return await acct.trial_balance(db, as_of_date)

    @api_router.get("/accounting/profit-loss")
    async def profit_loss_report(
        from_date: str = Query(...),
        to_date: str = Query(...),
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        return await acct.profit_loss(db, from_date, to_date)

    @api_router.get("/accounting/balance-sheet")
    async def balance_sheet_report(
        as_of_date: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        return await acct.balance_sheet(db, as_of_date)

    @api_router.get("/accounting/cash-flow")
    async def cash_flow_report(
        from_date: str = Query(...),
        to_date: str = Query(...),
        current_user: dict = Depends(get_current_user),
    ):
        require_global_accounting_access(current_user)
        return await acct.cash_flow(db, from_date, to_date)

    @api_router.get("/accounting/client-ledger")
    async def client_ledger(
        client_id: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        role = normalize_role(current_user.get("role"))
        if check_permission(current_user, "can_view_client_ledger"):
            target_client_id = current_user.get("client_id")
            if not target_client_id:
                raise HTTPException(status_code=400, detail="User has no client assigned")
        elif role in ("system_admin", "system_accounts"):
            if not client_id:
                raise HTTPException(status_code=400, detail="client_id query parameter required")
            target_client_id = client_id
        else:
            raise HTTPException(status_code=403, detail="Permission denied: can_view_client_ledger")
        require_client_ledger_access(current_user, target_client_id)
        return await acct.get_client_ledger(db, target_client_id)

    @api_router.get("/accounting/client-ledgers")
    async def client_ledgers_list(current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        return await acct.list_client_ledgers(db)

    @api_router.get("/accounting/vendor-ledgers")
    async def vendor_ledgers_list(current_user: dict = Depends(get_current_user)):
        role = normalize_role(current_user.get("role"))
        if check_permission(current_user, "can_view_vendor_ledger") and role == "vendor_accounts":
            vendor_id = current_user.get("vendor_id")
            if not vendor_id:
                raise HTTPException(status_code=400, detail="User has no vendor assigned")
            return await acct.list_vendor_ledgers(db, vendor_ids=[vendor_id])
        if role in ("system_admin", "system_accounts"):
            return await acct.list_vendor_ledgers(db)
        raise HTTPException(status_code=403, detail="Permission denied: can_view_vendor_ledger")

    @api_router.get("/accounting/vendor-ledger")
    async def vendor_ledger(
        vendor_id: Optional[str] = None,
        current_user: dict = Depends(get_current_user),
    ):
        role = normalize_role(current_user.get("role"))
        if check_permission(current_user, "can_view_vendor_ledger") and role == "vendor_accounts":
            target_vendor_id = current_user.get("vendor_id")
            if not target_vendor_id:
                raise HTTPException(status_code=400, detail="User has no vendor assigned")
        elif role in ("system_admin", "system_accounts"):
            if not vendor_id:
                raise HTTPException(status_code=400, detail="vendor_id query parameter required")
            target_vendor_id = vendor_id
        else:
            raise HTTPException(status_code=403, detail="Permission denied: can_view_vendor_ledger")
        require_vendor_ledger_access(current_user, target_vendor_id)
        return await acct.get_vendor_ledger(db, target_vendor_id)

    @api_router.get("/accounting/dashboard")
    async def accounting_dashboard(current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        return await acct.accounting_dashboard(db)

    @api_router.get("/groups/{group_id}/financial")
    async def group_financial(group_id: str, current_user: dict = Depends(get_current_user)):
        require_global_accounting_access(current_user)
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")
        return await acct.get_group_financial_summary(db, group_id)

    @api_router.patch("/groups/{group_id}/pricing")
    async def update_group_pricing(
        group_id: str,
        body: GroupPricingUpdate,
        current_user: dict = Depends(get_current_user),
    ):
        require_permission(current_user, "can_manage_financial")
        group = await db.groups.find_one({"id": group_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        if not can_access_group(current_user, group):
            raise HTTPException(status_code=403, detail="Access denied")
        return await acct.update_group_pricing(
            db,
            group_id,
            base_price_per_passport=body.base_price_per_passport,
            rush_fee=body.rush_fee,
        )

    @api_router.get("/accounting/client-visa-statement")
    async def client_visa_statement(
        client_id: Optional[str] = None,
        from_date: str = Query(...),
        to_date: str = Query(...),
        current_user: dict = Depends(get_current_user),
    ):
        target_client_id = _resolve_client_id_for_ledger(current_user, client_id)
        require_client_ledger_access(current_user, target_client_id)
        return await acct.build_client_visa_statement(db, target_client_id, from_date, to_date)

    @api_router.get("/accounting/vendor-visa-statement")
    async def vendor_visa_statement(
        vendor_id: Optional[str] = None,
        from_date: str = Query(...),
        to_date: str = Query(...),
        current_user: dict = Depends(get_current_user),
    ):
        target_vendor_id = _resolve_vendor_id_for_ledger(current_user, vendor_id)
        require_vendor_ledger_access(current_user, target_vendor_id)
        return await acct.build_vendor_visa_statement(db, target_vendor_id, from_date, to_date)

    @api_router.get("/accounting/client-visa-statement/export")
    async def export_client_visa_statement(
        client_id: Optional[str] = None,
        from_date: str = Query(...),
        to_date: str = Query(...),
        format: str = Query("csv", alias="format"),
        current_user: dict = Depends(get_current_user),
    ):
        target_client_id = _resolve_client_id_for_ledger(current_user, client_id)
        require_client_ledger_access(current_user, target_client_id)
        statement = await acct.build_client_visa_statement(db, target_client_id, from_date, to_date)
        safe_name = (statement.get("party_name") or "client").replace(" ", "_")
        if format == "pdf":
            pdf_bytes = _visa_statement_pdf_bytes(statement)
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": (
                        f'attachment; filename="visa_statement_{safe_name}_{from_date}_{to_date}.pdf"'
                    ),
                },
            )
        csv_content = acct.visa_statement_to_csv(statement)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="visa_statement_{safe_name}_{from_date}_{to_date}.csv"'
                ),
            },
        )

    @api_router.get("/accounting/vendor-visa-statement/export")
    async def export_vendor_visa_statement(
        vendor_id: Optional[str] = None,
        from_date: str = Query(...),
        to_date: str = Query(...),
        format: str = Query("csv", alias="format"),
        current_user: dict = Depends(get_current_user),
    ):
        target_vendor_id = _resolve_vendor_id_for_ledger(current_user, vendor_id)
        require_vendor_ledger_access(current_user, target_vendor_id)
        statement = await acct.build_vendor_visa_statement(db, target_vendor_id, from_date, to_date)
        safe_name = (statement.get("party_name") or "vendor").replace(" ", "_")
        if format == "pdf":
            pdf_bytes = _visa_statement_pdf_bytes(statement)
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": (
                        f'attachment; filename="visa_statement_{safe_name}_{from_date}_{to_date}.pdf"'
                    ),
                },
            )
        csv_content = acct.visa_statement_to_csv(statement)
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="visa_statement_{safe_name}_{from_date}_{to_date}.csv"'
                ),
            },
        )
