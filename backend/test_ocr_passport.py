import os

import pytest

from passport_parsing import (
    map_extracted_fields,
    normalize_mrz_line,
    parse_mrz,
    parse_passport_text,
)

SAMPLE_IMAGE = os.path.expanduser(
    "~/.cursor/projects/Users-hasanmahdi-Desktop-IQ-CRM-FINAL/assets/"
    "back-1bff8a4e-7417-46ea-ab78-72bd9c1cd8c4.png"
)

INDIAN_MRZ_LINE1 = "P<INDVIRANI<<MAZAHERALI<PYARALI<<<<<<<<<<<<<<"
INDIAN_MRZ_LINE2 = "28241735<8IND8110265M3503165<<<<<<<<<<<<<<04"


def test_normalize_mrz_line_fixes_passport_z():
    fixed = normalize_mrz_line(INDIAN_MRZ_LINE2, is_line2=True)
    assert fixed[:9].replace("<", "") == "Z8241735"


def test_parse_mrz_indian_passport():
    text = f"{INDIAN_MRZ_LINE1}\n{INDIAN_MRZ_LINE2}"
    data = parse_mrz(text)
    assert data["passport_no"] == "Z8241735"
    assert data["surname_en"] == "Virani"
    assert data["first_name_en"] == "Mazaherali Pyarali"
    assert data["nationality_code"] == "IND"
    assert data["birth_date"] == "1981-10-26"
    assert data["gender"] == "Male"
    assert data["expiry_date"] == "2035-03-16"


def test_parse_visual_father_mother_and_dates():
    visual = """
    PASSPORT NO. Z8241735
    DATE OF ISSUE 17/03/2025
    DATE OF EXPIRY 16/03/2035
    PLACE OF ISSUE MUMBAI
    NAME OF FATHER / LEGAL GUARDIAN PYARALI ALLADIN VIRANI
    NAME OF MOTHER ASHRAF BANOO PAYARALI VIRANI
    """
    combined = f"{INDIAN_MRZ_LINE1}\n{INDIAN_MRZ_LINE2}\n{visual}"
    data = parse_passport_text(combined)
    assert data["passport_no"] == "Z8241735"
    assert data["issue_date"] == "2025-03-17"
    assert data["place_of_issue"] == "Mumbai"
    assert "Pyarali" in data["father_name_en"]
    assert "Ashraf" in data["mother_name_en"]


def test_map_extracted_fields_nationality_and_place():
    raw = {
        "nationality_code": "IND",
        "place_of_issue": "MUMBAI",
        "first_name_en": "mazaherali pyarali",
        "surname_en": "virani",
    }
    mapped = map_extracted_fields(raw)
    assert mapped["nationality"] == "Indian"
    assert mapped["place_of_issue"] == "India"
    assert mapped["country_of_residence"] == "India"
    assert mapped["first_name_en"] == "Mazaherali Pyarali"
    assert mapped.get("arabic_names_suggested") is True
    assert mapped.get("first_name_ar")
    assert mapped.get("surname_ar")


def test_map_extracted_fields_rejects_ak_noise():
    raw = {"nationality_code": "IND", "place_of_issue": "AK"}
    mapped = map_extracted_fields(raw)
    assert mapped["nationality"] == "Indian"
    assert mapped["place_of_issue"] == "India"
    assert mapped["country_of_residence"] == "India"


@pytest.mark.skipif(not os.path.isfile(SAMPLE_IMAGE), reason="Sample passport image not available")
def test_integration_scan_sample_image():
    from ocr_service import extract_all_text_from_image

    with open(SAMPLE_IMAGE, "rb") as f:
        image_bytes = f.read()

    mrz_text, visual_text = extract_all_text_from_image(image_bytes)
    combined = "\n".join(part for part in (mrz_text, visual_text) if part)
    assert combined.strip()

    parsed = parse_passport_text(combined)
    mapped = map_extracted_fields(parsed)

    assert mapped.get("passport_no")
    assert mapped.get("first_name_en")
    assert mapped.get("surname_en")
    assert mapped.get("nationality") == "Indian" or mapped.get("nationality_code") == "IND"
    assert mapped.get("expiry_date")
    assert mapped.get("arabic_names_suggested") is True
