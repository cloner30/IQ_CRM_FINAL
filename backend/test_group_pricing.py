"""Tests for per-group visa selling rate resolution and updates."""

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from accounting import (
    resolve_group_pricing,
    compute_suggested_revenue,
    is_custom_group_pricing,
    pricing_breakdown,
    get_group_financial_summary,
    update_group_pricing,
)
from permissions import check_permission, require_permission


def test_resolve_group_pricing_uses_client_defaults():
    group = {}
    client = {"base_price_per_passport": 20.0, "rush_fee": 5.0}
    assert resolve_group_pricing(group, client) == (20.0, 5.0)


def test_resolve_group_pricing_uses_group_overrides():
    group = {"base_price_per_passport": 25.0, "rush_fee": 10.0}
    client = {"base_price_per_passport": 20.0, "rush_fee": 5.0}
    assert resolve_group_pricing(group, client) == (25.0, 10.0)


def test_resolve_group_pricing_partial_override():
    group = {"base_price_per_passport": 22.0}
    client = {"base_price_per_passport": 20.0, "rush_fee": 5.0}
    assert resolve_group_pricing(group, client) == (22.0, 5.0)


def test_compute_suggested_revenue():
    group = {"base_price_per_passport": 10.0, "rush_fee": 5.0}
    client = {}
    assert compute_suggested_revenue(3, group, client) == 35.0


def test_is_custom_group_pricing_false_when_matching_client():
    group = {"base_price_per_passport": 20.0, "rush_fee": 0.0}
    client = {"base_price_per_passport": 20.0, "rush_fee": 0.0}
    assert is_custom_group_pricing(group, client) is False


def test_is_custom_group_pricing_true_when_different():
    group = {"base_price_per_passport": 21.0, "rush_fee": 0.0}
    client = {"base_price_per_passport": 20.0, "rush_fee": 0.0}
    assert is_custom_group_pricing(group, client) is True


def test_pricing_breakdown():
    group = {"base_price_per_passport": 15.0, "rush_fee": 2.0}
    client = {"base_price_per_passport": 20.0, "rush_fee": 0.0}
    result = pricing_breakdown(group, client, 4)
    assert result["suggested_revenue"] == 62.0
    assert result["is_custom_pricing"] is True
    assert result["passenger_count"] == 4


def test_get_group_financial_summary_with_custom_pricing():
    db = MagicMock()
    db.groups.find_one = AsyncMock(return_value={
        "id": "g1",
        "client_id": "c1",
        "passenger_count": 5,
        "base_price_per_passport": 25.0,
        "rush_fee": 0.0,
    })
    db.clients.find_one = AsyncMock(return_value={
        "id": "c1",
        "base_price_per_passport": 20.0,
        "rush_fee": 0.0,
    })
    db.passports.count_documents = AsyncMock(return_value=5)
    db.vendor_payables.find = MagicMock(return_value=MagicMock(
        to_list=AsyncMock(return_value=[])
    ))

    result = asyncio.run(get_group_financial_summary(db, "g1"))

    assert result["suggested_revenue"] == 125.0
    assert result["base_price_per_passport"] == 25.0
    assert result["is_custom_pricing"] is True
    assert result["client_base_price_per_passport"] == 20.0
    assert result["expected_vendor_cost"] == 0.0


def test_update_group_pricing_rejects_negative_rate():
    db = MagicMock()
    db.groups.find_one = AsyncMock(return_value={"id": "g1", "client_id": "c1"})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(update_group_pricing(db, "g1", base_price_per_passport=-1.0))
    assert exc.value.status_code == 400


def test_update_group_pricing_persists_and_returns_summary():
    db = MagicMock()
    db.groups.find_one = AsyncMock(side_effect=[
        {"id": "g1", "client_id": "c1", "passenger_count": 2, "base_price_per_passport": 20.0, "rush_fee": 0.0},
        {"id": "g1", "client_id": "c1", "passenger_count": 2, "base_price_per_passport": 30.0, "rush_fee": 5.0},
    ])
    db.groups.update_one = AsyncMock()
    db.clients.find_one = AsyncMock(return_value={"base_price_per_passport": 20.0, "rush_fee": 0.0})
    db.passports.count_documents = AsyncMock(return_value=2)
    db.vendor_payables.find = MagicMock(return_value=MagicMock(to_list=AsyncMock(return_value=[])))

    result = asyncio.run(update_group_pricing(db, "g1", base_price_per_passport=30.0, rush_fee=5.0))

    db.groups.update_one.assert_called_once()
    assert result["suggested_revenue"] == 65.0
    assert result["base_price_per_passport"] == 30.0


def test_split_inherits_parent_pricing_fields():
    """Split copies all group fields; pricing should be included in the spread."""
    parent = {
        "id": "g-parent",
        "name": "Tour Group",
        "client_id": "c1",
        "base_price_per_passport": 28.0,
        "rush_fee": 3.0,
        "departure_date": "2025-06-01",
        "status": "SUBMITTED_FOR_PROCESS",
    }
    child = {
        **{k: v for k, v in parent.items() if k != "_id"},
        "id": "g-child",
        "name": "Tour Group - Batch 1",
        "split_from_group_id": "g-parent",
    }
    client = {"base_price_per_passport": 20.0, "rush_fee": 0.0}
    assert resolve_group_pricing(child, client) == (28.0, 3.0)
    assert is_custom_group_pricing(child, client) is True


def test_system_accounts_can_manage_financial():
    user = {"role": "system_accounts", "status": "active"}
    assert check_permission(user, "can_manage_financial") is True
    require_permission(user, "can_manage_financial")


def test_client_staff_cannot_manage_financial():
    user = {"role": "client_staff", "status": "active", "client_id": "c1"}
    assert check_permission(user, "can_manage_financial") is False
    with pytest.raises(HTTPException) as exc:
        require_permission(user, "can_manage_financial")
    assert exc.value.status_code == 403
