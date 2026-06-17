"""Validation helpers for group visa outcome completion."""

from typing import List, Literal, Tuple

from fastapi import HTTPException

VISA_OUTCOME_STATUSES = frozenset({"visa_issued", "visa_rejected"})


def derive_group_visa_status(rejected_count: int) -> Literal["VISA_ISSUED", "VISA_REJECTED"]:
    return "VISA_REJECTED" if rejected_count > 0 else "VISA_ISSUED"


def validate_visa_outcomes(
    group_passport_ids: List[str],
    outcomes: List[dict],
) -> Tuple[int, int]:
    """Validate one outcome per passport; return (issued_count, rejected_count)."""
    expected = set(group_passport_ids)
    if not expected:
        raise HTTPException(status_code=400, detail="Group has no passengers")

    seen = set()
    issued = 0
    rejected = 0

    for item in outcomes:
        passport_id = item.get("passport_id") if isinstance(item, dict) else item.passport_id
        visa_status = item.get("visa_status") if isinstance(item, dict) else item.visa_status

        if passport_id in seen:
            raise HTTPException(status_code=400, detail=f"Duplicate passport in outcomes: {passport_id}")
        seen.add(passport_id)

        if passport_id not in expected:
            raise HTTPException(status_code=400, detail=f"Passport {passport_id} is not in this group")
        if visa_status not in VISA_OUTCOME_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid visa outcome for {passport_id}. Use visa_issued or visa_rejected",
            )

        if visa_status == "visa_issued":
            issued += 1
        else:
            rejected += 1

    missing = expected - seen
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing outcomes for {len(missing)} passenger(s)",
        )

    return issued, rejected
