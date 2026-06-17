"""Canonical group workflow status definitions — single source of truth."""

from typing import Dict, List, Set

DEFAULT_STATUS = "DATA_PROCESSING"

GROUP_STATUSES: List[str] = [
    "DATA_PROCESSING",
    "SUBMITTED_FOR_PROCESS",
    "VENDOR_ASSIGNED",
    "VISA_IN_PROCESS",
    "VISA_ISSUED",
    "VISA_REJECTED",
]

STATUS_LABELS: Dict[str, str] = {
    "DATA_PROCESSING": "Data Processing",
    "SUBMITTED_FOR_PROCESS": "Submitted for Process",
    "VENDOR_ASSIGNED": "Vendor Assigned",
    "VISA_IN_PROCESS": "Visa In Process",
    "VISA_ISSUED": "Visa Issued",
    "VISA_REJECTED": "Visa Rejected",
}

VALID_STATUS_TRANSITIONS: Dict[str, List[str]] = {
    "DATA_PROCESSING": ["SUBMITTED_FOR_PROCESS"],
    "SUBMITTED_FOR_PROCESS": ["DATA_PROCESSING"],
    "VENDOR_ASSIGNED": ["VISA_IN_PROCESS"],
    "VISA_IN_PROCESS": ["VISA_ISSUED", "VISA_REJECTED"],
    "VISA_ISSUED": [],
    "VISA_REJECTED": ["DATA_PROCESSING", "VENDOR_ASSIGNED"],
}

STATUS_STEPPER_ORDER: List[str] = [
    "DATA_PROCESSING",
    "SUBMITTED_FOR_PROCESS",
    "VENDOR_ASSIGNED",
    "VISA_IN_PROCESS",
    "VISA_ISSUED",
]

STATUS_MIGRATION_MAP: Dict[str, str] = {
    "DATA_ENTRY": "DATA_PROCESSING",
    "SUBMITTED": "SUBMITTED_FOR_PROCESS",
    "PENDING_PROCESS": "VENDOR_ASSIGNED",
    "VISA_SUBMITTED": "VISA_IN_PROCESS",
    "VISA_ISSUED": "VISA_ISSUED",
    "VISA_REJECTED": "VISA_REJECTED",
    "COMPLETED": "VISA_ISSUED",
}

TERMINAL_STATUSES: Set[str] = {"VISA_ISSUED"}

REASON_REQUIRED_FOR: Set[str] = {"VISA_REJECTED"}

SUBMITTED_STATUS = "SUBMITTED_FOR_PROCESS"
VENDOR_ASSIGNED_STATUS = "VENDOR_ASSIGNED"


def normalize_status(status: str) -> str:
    """Map legacy status codes to current codes."""
    if not status:
        return DEFAULT_STATUS
    return STATUS_MIGRATION_MAP.get(status, status)


def get_status_definitions() -> dict:
    """Return JSON-serializable status definitions for API consumers."""
    return {
        "statuses": GROUP_STATUSES,
        "labels": STATUS_LABELS,
        "transitions": VALID_STATUS_TRANSITIONS,
        "stepper_order": STATUS_STEPPER_ORDER,
        "terminal": list(TERMINAL_STATUSES),
        "reason_required": list(REASON_REQUIRED_FOR),
        "default_status": DEFAULT_STATUS,
    }
