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

GROUP_STATUSES = [
    "DATA_ENTRY",
    "SUBMITTED",
    "PENDING_PROCESS",
    "VISA_SUBMITTED",
    "VISA_ISSUED",
    "VISA_REJECTED",
    "COMPLETED",
]

VALID_STATUS_TRANSITIONS = {
    "DATA_ENTRY": ["SUBMITTED"],
    "SUBMITTED": ["PENDING_PROCESS", "DATA_ENTRY"],
    "PENDING_PROCESS": ["VISA_SUBMITTED", "SUBMITTED"],
    "VISA_SUBMITTED": ["VISA_ISSUED", "VISA_REJECTED"],
    "VISA_ISSUED": ["COMPLETED"],
    "VISA_REJECTED": ["DATA_ENTRY", "PENDING_PROCESS"],
    "COMPLETED": [],
}

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
    },
    "client_admin": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": True,
        "can_access_financial": True,
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
        "can_split_groups": True,
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
    },
    "vendor_admin": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": True,
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
    },
    "vendor_staff": {
        "can_create_group_any_client": False,
        "can_view_all_groups": False,
        "can_update_group_status": True,
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
