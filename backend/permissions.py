"""Role-based permissions for ACF CRM enterprise."""

from typing import Dict, Optional
from fastapi import HTTPException

# Legacy roles map to canonical enterprise roles
LEGACY_ROLE_MAP = {
    "admin": "system_admin",
    "super_admin": "system_admin",
    "staff": "client_staff",  # overridden by migration if no client_id
}

VALID_ROLES = [
    "system_admin",
    "system_staff",
    "system_accounts",
    "client_admin",
    "client_staff",
    "client_accounts",
    "vendor_admin",
    "vendor_staff",
    "vendor_accounts",
]

SYSTEM_ROLES = {"system_admin", "system_staff", "system_accounts"}
CLIENT_ROLES = {"client_admin", "client_staff", "client_accounts"}
VENDOR_ROLES = {"vendor_admin", "vendor_staff", "vendor_accounts"}
ACCOUNTS_ROLES = {"system_accounts", "client_accounts", "vendor_accounts"}

from group_status import GROUP_STATUSES, VALID_STATUS_TRANSITIONS

ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "system_admin": {
        "can_create_group_any_client": True,
        "can_view_all_groups": True,
        "can_update_group_status": True,
        "can_access_financial": True,
        "can_manage_financial": True,
        "can_manage_vendors": True,
        "can_assign_vendor": True,
        "can_manage_clients": True,
        "can_manage_users": True,
        "can_view_operational": True,
        "can_edit_passports": True,
        "can_export": True,
        "can_import": True,
        "can_upload_files": True,
        "can_split_groups": True,
        "can_post_journal_entries": True,
        "can_initialize_accounts": True,
        "can_record_receipts": True,
        "can_view_global_accounting": True,
        "can_submit_group": True,
        "can_update_passport_status": True,
        "can_manage_submission_details": True,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": True,
    },
    "system_staff": {
        "can_create_group_any_client": True,
        "can_view_all_groups": True,
        "can_update_group_status": True,
        "can_access_financial": False,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": True,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": True,
        "can_edit_passports": True,
        "can_export": True,
        "can_import": True,
        "can_upload_files": True,
        "can_split_groups": True,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": True,
        "can_update_passport_status": True,
        "can_manage_submission_details": True,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": False,
    },
    "system_accounts": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": True,
        "can_manage_financial": True,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": False,
        "can_edit_passports": False,
        "can_export": False,
        "can_import": False,
        "can_upload_files": False,
        "can_split_groups": False,
        "can_post_journal_entries": True,
        "can_initialize_accounts": False,
        "can_record_receipts": True,
        "can_view_global_accounting": True,
        "can_submit_group": False,
        "can_update_passport_status": False,
        "can_manage_submission_details": False,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": True,
    },
    "client_admin": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": False,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": True,
        "can_view_operational": True,
        "can_edit_passports": True,
        "can_export": True,
        "can_import": True,
        "can_upload_files": True,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": True,
        "can_update_passport_status": False,
        "can_manage_submission_details": False,
        "can_view_client_ledger": True,
        "can_view_vendor_ledger": False,
    },
    "client_staff": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": False,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": True,
        "can_edit_passports": True,
        "can_export": True,
        "can_import": True,
        "can_upload_files": True,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": False,
        "can_update_passport_status": False,
        "can_manage_submission_details": False,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": False,
    },
    "client_accounts": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": True,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": False,
        "can_edit_passports": False,
        "can_export": False,
        "can_import": False,
        "can_upload_files": False,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": False,
        "can_update_passport_status": False,
        "can_manage_submission_details": False,
        "can_view_client_ledger": True,
        "can_view_vendor_ledger": False,
    },
    "vendor_admin": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": False,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": True,
        "can_view_operational": True,
        "can_edit_passports": False,
        "can_export": True,
        "can_import": False,
        "can_upload_files": True,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": False,
        "can_update_passport_status": True,
        "can_manage_submission_details": False,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": False,
    },
    "vendor_staff": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": False,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": True,
        "can_edit_passports": False,
        "can_export": True,
        "can_import": False,
        "can_upload_files": True,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": False,
        "can_update_passport_status": True,
        "can_manage_submission_details": False,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": False,
    },
    "vendor_accounts": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": False,
        "can_access_financial": True,
        "can_manage_financial": False,
        "can_manage_vendors": False,
        "can_assign_vendor": False,
        "can_manage_clients": False,
        "can_manage_users": False,
        "can_view_operational": False,
        "can_edit_passports": False,
        "can_export": False,
        "can_import": False,
        "can_upload_files": False,
        "can_split_groups": False,
        "can_post_journal_entries": False,
        "can_initialize_accounts": False,
        "can_record_receipts": False,
        "can_view_global_accounting": False,
        "can_submit_group": False,
        "can_update_passport_status": False,
        "can_manage_submission_details": False,
        "can_view_client_ledger": False,
        "can_view_vendor_ledger": True,
    },
}


def normalize_role(role: Optional[str]) -> str:
    if not role:
        return "client_staff"
    return LEGACY_ROLE_MAP.get(role, role)


def get_role_permissions(user: dict) -> Dict[str, bool]:
    role = normalize_role(user.get("role"))
    base = dict(ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["client_staff"]))
    overrides = user.get("permissions") or {}
    base.update({k: v for k, v in overrides.items() if k in base})
    return base


def check_permission(user: dict, permission: str) -> bool:
    if user.get("status") == "inactive":
        return False
    return get_role_permissions(user).get(permission, False)


def require_permission(user: dict, permission: str) -> None:
    if not check_permission(user, permission):
        raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")


def require_global_accounting_access(user: dict) -> None:
    require_permission(user, "can_view_global_accounting")


def require_submit_group(user: dict) -> None:
    require_permission(user, "can_submit_group")


def require_passport_status_update(user: dict) -> None:
    require_permission(user, "can_update_passport_status")


def require_submission_details(user: dict) -> None:
    require_permission(user, "can_manage_submission_details")


def require_client_ledger_access(user: dict, client_id: Optional[str] = None) -> None:
    if check_permission(user, "can_view_client_ledger"):
        if client_id and not can_access_client_financial(user, client_id):
            raise HTTPException(status_code=403, detail="Access denied to this client")
        return
    role = normalize_role(user.get("role"))
    if role in ("system_admin", "system_accounts"):
        if client_id and not can_access_client_financial(user, client_id):
            raise HTTPException(status_code=403, detail="Access denied to this client")
        return
    raise HTTPException(status_code=403, detail="Permission denied: can_view_client_ledger")


def require_vendor_ledger_access(user: dict, vendor_id: Optional[str] = None) -> None:
    if check_permission(user, "can_view_vendor_ledger"):
        if vendor_id and not can_access_vendor_financial(user, vendor_id):
            raise HTTPException(status_code=403, detail="Access denied to this vendor")
        return
    role = normalize_role(user.get("role"))
    if role in ("system_admin", "system_accounts"):
        if vendor_id and not can_access_vendor_financial(user, vendor_id):
            raise HTTPException(status_code=403, detail="Access denied to this vendor")
        return
    raise HTTPException(status_code=403, detail="Permission denied: can_view_vendor_ledger")


def is_system_role(user: dict) -> bool:
    return normalize_role(user.get("role")) in SYSTEM_ROLES


def is_vendor_role(user: dict) -> bool:
    return normalize_role(user.get("role")) in VENDOR_ROLES


def is_accounts_role(user: dict) -> bool:
    return normalize_role(user.get("role")) in ACCOUNTS_ROLES


def can_access_client(user: dict, client_id: Optional[str]) -> bool:
    role = normalize_role(user.get("role"))
    if role in SYSTEM_ROLES:
        return True
    if role in VENDOR_ROLES:
        return False
    if role in CLIENT_ROLES:
        return user.get("client_id") == client_id
    return False


def can_access_user_for_admin(actor: dict, target: dict) -> bool:
    role = normalize_role(actor.get("role"))
    if role in ("system_admin", "system_staff"):
        return True
    if role == "client_admin":
        return target.get("client_id") == actor.get("client_id")
    if role == "vendor_admin":
        return target.get("vendor_id") == actor.get("vendor_id")
    return False


def can_access_group(user: dict, group: dict) -> bool:
    role = normalize_role(user.get("role"))
    if role in SYSTEM_ROLES:
        return True
    if role in VENDOR_ROLES:
        return group.get("assigned_vendor_id") == user.get("vendor_id")
    if role in CLIENT_ROLES and not is_accounts_role(user):
        return user.get("client_id") == group.get("client_id")
    return False


def get_user_group_filter(user: dict) -> dict:
    role = normalize_role(user.get("role"))
    if role in SYSTEM_ROLES and role != "system_accounts":
        return {"is_archived": {"$ne": True}}
    if role in VENDOR_ROLES and not is_accounts_role(user):
        return {"assigned_vendor_id": user.get("vendor_id"), "is_archived": {"$ne": True}}
    if role in CLIENT_ROLES and not is_accounts_role(user):
        if user.get("client_id"):
            return {"client_id": user.get("client_id"), "is_archived": {"$ne": True}}
        return {"client_id": None}
    return {"client_id": "__none__"}


def get_user_client_filter(user: dict) -> dict:
    role = normalize_role(user.get("role"))
    if role in SYSTEM_ROLES:
        return {}
    if role in CLIENT_ROLES:
        if user.get("client_id"):
            return {"client_id": user.get("client_id")}
        return {"client_id": None}
    return {"client_id": "__none__"}


def can_access_vendor_financial(user: dict, vendor_id: Optional[str]) -> bool:
    role = normalize_role(user.get("role"))
    if role in ("system_admin", "system_staff", "system_accounts"):
        return True
    if role == "vendor_accounts":
        return user.get("vendor_id") == vendor_id
    return False


def can_access_client_financial(user: dict, client_id: Optional[str]) -> bool:
    role = normalize_role(user.get("role"))
    if role in ("system_admin", "system_staff", "system_accounts"):
        return True
    if role in ("client_admin", "client_accounts"):
        return user.get("client_id") == client_id
    return False


def migrate_role(old_role: str, client_id: Optional[str], vendor_id: Optional[str]) -> str:
    if old_role in ("admin", "super_admin"):
        return "system_admin"
    if old_role == "client_admin":
        return "client_admin"
    if old_role == "staff":
        if vendor_id:
            return "vendor_staff"
        if client_id:
            return "client_staff"
        return "system_staff"
    if old_role in VALID_ROLES:
        return old_role
    return "client_staff"
