"""Tests for visa outcome validation and group status derivation."""

import pytest
from fastapi import HTTPException

from visa_outcome import validate_visa_outcomes, derive_group_visa_status


def test_derive_group_visa_status_all_issued():
    assert derive_group_visa_status(0) == "VISA_ISSUED"


def test_derive_group_visa_status_any_rejected():
    assert derive_group_visa_status(1) == "VISA_REJECTED"
    assert derive_group_visa_status(3) == "VISA_REJECTED"


def test_validate_visa_outcomes_all_issued():
    issued, rejected = validate_visa_outcomes(
        ["p1", "p2", "p3"],
        [
            {"passport_id": "p1", "visa_status": "visa_issued"},
            {"passport_id": "p2", "visa_status": "visa_issued"},
            {"passport_id": "p3", "visa_status": "visa_issued"},
        ],
    )
    assert issued == 3
    assert rejected == 0


def test_validate_visa_outcomes_mixed():
    issued, rejected = validate_visa_outcomes(
        ["p1", "p2", "p3"],
        [
            {"passport_id": "p1", "visa_status": "visa_issued"},
            {"passport_id": "p2", "visa_status": "visa_rejected"},
            {"passport_id": "p3", "visa_status": "visa_rejected"},
        ],
    )
    assert issued == 1
    assert rejected == 2


def test_validate_visa_outcomes_missing_passenger():
    with pytest.raises(HTTPException) as exc:
        validate_visa_outcomes(
            ["p1", "p2"],
            [{"passport_id": "p1", "visa_status": "visa_issued"}],
        )
    assert exc.value.status_code == 400
    assert "Missing outcomes" in exc.value.detail


def test_validate_visa_outcomes_unknown_passenger():
    with pytest.raises(HTTPException) as exc:
        validate_visa_outcomes(
            ["p1"],
            [{"passport_id": "p99", "visa_status": "visa_issued"}],
        )
    assert exc.value.status_code == 400
    assert "not in this group" in exc.value.detail


def test_validate_visa_outcomes_duplicate_passenger():
    with pytest.raises(HTTPException) as exc:
        validate_visa_outcomes(
            ["p1"],
            [
                {"passport_id": "p1", "visa_status": "visa_issued"},
                {"passport_id": "p1", "visa_status": "visa_rejected"},
            ],
        )
    assert exc.value.status_code == 400
    assert "Duplicate" in exc.value.detail


def test_validate_visa_outcomes_invalid_status():
    with pytest.raises(HTTPException) as exc:
        validate_visa_outcomes(
            ["p1"],
            [{"passport_id": "p1", "visa_status": "payment_done"}],
        )
    assert exc.value.status_code == 400
    assert "Invalid visa outcome" in exc.value.detail


def test_validate_visa_outcomes_empty_group():
    with pytest.raises(HTTPException) as exc:
        validate_visa_outcomes([], [])
    assert exc.value.status_code == 400
    assert "no passengers" in exc.value.detail.lower()
