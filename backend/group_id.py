"""Group ID generation: GRP-YYYY-DDMMM-XXXXX (e.g. GRP-2026-15APR-00142)."""

from datetime import datetime


async def get_next_sequence(db, departure_date: str) -> int:
    counter_id = f"group_seq_{departure_date}"
    result = await db.counters.find_one_and_update(
        {"_id": counter_id},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return result["seq"]


async def generate_group_id(db, departure_date: str) -> str:
    date_obj = datetime.fromisoformat(departure_date.replace("Z", "+00:00")[:10])
    year = date_obj.year
    day = date_obj.strftime("%d")
    month = date_obj.strftime("%b").upper()
    sequence = await get_next_sequence(db, departure_date[:10])
    return f"GRP-{year}-{day}{month}-{sequence:05d}"


async def preview_group_id(db, departure_date: str) -> str:
    date_obj = datetime.fromisoformat(departure_date.replace("Z", "+00:00")[:10])
    year = date_obj.year
    day = date_obj.strftime("%d")
    month = date_obj.strftime("%b").upper()
    counter_id = f"group_seq_{departure_date[:10]}"
    counter = await db.counters.find_one({"_id": counter_id})
    next_seq = (counter["seq"] if counter else 0) + 1
    return f"GRP-{year}-{day}{month}-{next_seq:05d}"
