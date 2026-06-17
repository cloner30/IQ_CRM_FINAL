"""Tests for bidirectional group/passenger status sync."""

import pytest
from fastapi import HTTPException

from status_sync import (
    build_passport_status_update,
    build_passport_visa_update,
    validate_group_transition_aggregate,
)
from visa_outcome import derive_group_visa_status as derive_from_outcome, validate_visa_outcomes


def test_build_passport_status_done_sets_form_submitted():
    update = build_passport_status_update("done", "pending", "2026-01-01T00:00:00Z")
    assert update["status"] == "done"
    assert update["visa_status"] == "form_submitted"


def test_build_passport_status_pending_resets_form_submitted():
    update = build_passport_status_update("pending", "form_submitted", "2026-01-01T00:00:00Z")
    assert update["status"] == "pending"
    assert update["visa_status"] == "pending"


def test_build_passport_status_pending_keeps_payment_done():
    update = build_passport_status_update("pending", "payment_done", "2026-01-01T00:00:00Z")
    assert update["status"] == "pending"
    assert "visa_status" not in update


def test_build_passport_visa_form_submitted_sets_done():
    update = build_passport_visa_update("form_submitted", "2026-01-01T00:00:00Z")
    assert update["visa_status"] == "form_submitted"
    assert update["status"] == "done"


def test_build_passport_visa_pending_resets_status():
    update = build_passport_visa_update("pending", "2026-01-01T00:00:00Z")
    assert update["visa_status"] == "pending"
    assert update["status"] == "pending"


def test_validate_visa_in_process_requires_all_forms_done():
    agg = {"all_forms_done": False}
    with pytest.raises(HTTPException) as exc:
        validate_group_transition_aggregate("VENDOR_ASSIGNED", "VISA_IN_PROCESS", agg, True)
    assert exc.value.status_code == 400
    assert "All passengers must complete forms" in exc.value.detail


def test_validate_terminal_blocked():
    agg = {"all_forms_done": True}
    with pytest.raises(HTTPException) as exc:
        validate_group_transition_aggregate("VISA_IN_PROCESS", "VISA_ISSUED", agg, True)
    assert exc.value.status_code == 400


def test_validate_visa_in_process_allowed_when_ready():
    agg = {"all_forms_done": True}
    validate_group_transition_aggregate("VENDOR_ASSIGNED", "VISA_IN_PROCESS", agg, True)


def test_outcome_validation_still_works():
    issued, rejected = validate_visa_outcomes(
        ["p1"],
        [{"passport_id": "p1", "visa_status": "visa_issued"}],
    )
    assert issued == 1
    assert rejected == 0
    assert derive_from_outcome(rejected) == "VISA_ISSUED"
