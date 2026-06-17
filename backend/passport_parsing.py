import re
from typing import Optional

from arabic_name_generator import ArabicNameGenerator

COUNTRY_TO_NATIONALITY = {
    "AFG": "Afghan",
    "ALB": "Albanian",
    "DZA": "Algerian",
    "AND": "Andorran",
    "AGO": "Angolan",
    "ARG": "Argentine",
    "ARM": "Armenian",
    "AUS": "Australian",
    "AUT": "Austrian",
    "AZE": "Azerbaijani",
    "BHR": "Bahraini",
    "BGD": "Bangladeshi",
    "BLR": "Belarusian",
    "BEL": "Belgian",
    "BTN": "Bhutanese",
    "BOL": "Bolivian",
    "BIH": "Bosnian",
    "BRA": "Brazilian",
    "BRN": "Bruneian",
    "BGR": "Bulgarian",
    "KHM": "Cambodian",
    "CMR": "Cameroonian",
    "CAN": "Canadian",
    "TCD": "Chadian",
    "CHL": "Chilean",
    "CHN": "Chinese",
    "COL": "Colombian",
    "CRI": "Costa Rican",
    "HRV": "Croatian",
    "CUB": "Cuban",
    "CYP": "Cypriot",
    "CZE": "Czech",
    "DNK": "Danish",
    "ECU": "Ecuadorian",
    "EGY": "Egyptian",
    "EST": "Estonian",
    "ETH": "Ethiopian",
    "FIN": "Finnish",
    "FRA": "French",
    "GEO": "Georgian",
    "DEU": "German",
    "GHA": "Ghanaian",
    "GRC": "Greek",
    "GTM": "Guatemalan",
    "HND": "Honduran",
    "HKG": "Hong Konger",
    "HUN": "Hungarian",
    "ISL": "Icelandic",
    "IND": "Indian",
    "IDN": "Indonesian",
    "IRN": "Iranian",
    "IRQ": "Iraqi",
    "IRL": "Irish",
    "ISR": "Israeli",
    "ITA": "Italian",
    "JPN": "Japanese",
    "JOR": "Jordanian",
    "KAZ": "Kazakhstani",
    "KEN": "Kenyan",
    "KWT": "Kuwaiti",
    "KGZ": "Kyrgyzstani",
    "LVA": "Latvian",
    "LBN": "Lebanese",
    "LBY": "Libyan",
    "LTU": "Lithuanian",
    "LUX": "Luxembourger",
    "MYS": "Malaysian",
    "MDV": "Maldivian",
    "MLT": "Maltese",
    "MEX": "Mexican",
    "MDA": "Moldovan",
    "MCO": "Monacan",
    "MNG": "Mongolian",
    "MAR": "Moroccan",
    "MMR": "Myanmar",
    "NPL": "Nepalese",
    "NLD": "Dutch",
    "NZL": "New Zealander",
    "NGA": "Nigerian",
    "PRK": "North Korean",
    "NOR": "Norwegian",
    "OMN": "Omani",
    "PAK": "Pakistani",
    "PSE": "Palestinian",
    "PAN": "Panamanian",
    "PER": "Peruvian",
    "PHL": "Filipino",
    "POL": "Polish",
    "PRT": "Portuguese",
    "QAT": "Qatari",
    "ROU": "Romanian",
    "RUS": "Russian",
    "SAU": "Saudi",
    "SRB": "Serbian",
    "SGP": "Singaporean",
    "SVK": "Slovak",
    "SVN": "Slovenian",
    "SOM": "Somali",
    "ZAF": "South African",
    "KOR": "South Korean",
    "ESP": "Spanish",
    "LKA": "Sri Lankan",
    "SDN": "Sudanese",
    "SWE": "Swedish",
    "CHE": "Swiss",
    "SYR": "Syrian",
    "TWN": "Taiwanese",
    "TJK": "Tajikistani",
    "TZA": "Tanzanian",
    "THA": "Thai",
    "TUN": "Tunisian",
    "TUR": "Turkish",
    "TKM": "Turkmen",
    "ARE": "Emirati",
    "UGA": "Ugandan",
    "UKR": "Ukrainian",
    "GBR": "British",
    "USA": "American",
    "URY": "Uruguayan",
    "UZB": "Uzbekistani",
    "VEN": "Venezuelan",
    "VNM": "Vietnamese",
    "YEM": "Yemeni",
    "ZMB": "Zambian",
    "ZWE": "Zimbabwean",
}

CITY_TO_COUNTRY = {
    "MUMBAI": "India",
    "DELHI": "India",
    "CHENNAI": "India",
    "KOLKATA": "India",
    "BANGALORE": "India",
    "HYDERABAD": "India",
    "AHMEDABAD": "India",
    "PUNE": "India",
    "DUBAI": "United Arab Emirates",
    "ABU DHABI": "United Arab Emirates",
    "RIYADH": "Saudi Arabia",
    "JEDDAH": "Saudi Arabia",
    "DOHA": "Qatar",
    "MUSCAT": "Oman",
    "KUWAIT": "Kuwait",
    "MANAMA": "Bahrain",
    "BAGHDAD": "Iraq",
    "BASRA": "Iraq",
    "ERBIL": "Iraq",
    "LONDON": "United Kingdom of Great Britain",
    "NEW YORK": "United States of America",
}

PLACE_BLOCKLIST = {
    "AK", "AU", "NA", "IND", "NO", "OF", "OR", "TO", "IN", "AT", "ON", "AS", "IS", "IT", "AN",
    "BE", "BY", "DO", "GO", "HE", "IF", "ME", "MY", "SO", "UP", "US", "WE",
}

KNOWN_COUNTRIES = {
    "Afghanistan", "Albania", "Algeria", "United States of America", "Andorra", "Angola",
    "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahrain", "Bangladesh",
    "Belarus", "Belgium", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil",
    "United Kingdom of Great Britain", "Brunei Darussalam", "Bulgaria", "Cambodia", "Cameroon",
    "Canada", "Chad", "Chile", "China", "Colombia", "Costa Rica", "Croatia", "Cuba", "Cyprus",
    "Czech Republic", "Denmark", "Netherlands", "Ecuador", "Egypt", "United Arab Emirates",
    "Estonia", "Ethiopia", "Philippines", "Finland", "France", "Georgia", "Germany", "Ghana",
    "Greece", "Guatemala", "Honduras", "Hungary", "Iceland", "India", "Indonesia",
    "Iran Islamic Republic of", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan",
    "Kazakhstan", "Kenya", "Kuwait", "Kyrgyzstan", "Latvia", "Lebanon", "Libyan Arab Jamahiriya",
    "Lithuania", "Luxembourg", "Malaysia", "Maldives", "Malta", "Mexico", "Moldova", "Mongolia",
    "Morocco", "Nepal", "New Zealand", "Nigeria", "Democratic Peoples Republic of Korea", "Norway",
    "Oman", "Pakistan", "Palestinian", "Panama", "Peru", "Poland", "Portugal", "Qatar", "Romania",
    "Russian Federation", "Saudi Arabia", "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia",
    "South Africa", "Republic of Korea", "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland",
    "Syrian Arab Republic", "Tajikistan", "United Republic of Tanzania", "Thailand", "Tunisia",
    "Turkey", "Turkmenistan", "Uganda", "Ukraine", "Uruguay", "Uzbekistan",
    "Venezuela Bolivarian Republic", "Viet Nam", "Yemen", "Zambia", "Zimbabwe",
}

NATIONALITY_TO_COUNTRY = {
    "Afghan": "Afghanistan", "Albanian": "Albania", "Algerian": "Algeria",
    "American": "United States of America", "Andorran": "Andorra", "Angolan": "Angola",
    "Argentine": "Argentina", "Armenian": "Armenia", "Australian": "Australia",
    "Austrian": "Austria", "Azerbaijani": "Azerbaijan", "Bahraini": "Bahrain",
    "Bangladeshi": "Bangladesh", "Belarusian": "Belarus", "Belgian": "Belgium",
    "Bhutanese": "Bhutan", "Bolivian": "Bolivia", "Bosnian": "Bosnia and Herzegovina",
    "Brazilian": "Brazil", "British": "United Kingdom of Great Britain",
    "Bruneian": "Brunei Darussalam", "Bulgarian": "Bulgaria", "Cambodian": "Cambodia",
    "Cameroonian": "Cameroon", "Canadian": "Canada", "Chadian": "Chad", "Chilean": "Chile",
    "Chinese": "China", "Colombian": "Colombia", "Costa Rican": "Costa Rica",
    "Croatian": "Croatia", "Cuban": "Cuba", "Cypriot": "Cyprus", "Czech": "Czech Republic",
    "Danish": "Denmark", "Dutch": "Netherlands", "Ecuadorian": "Ecuador", "Egyptian": "Egypt",
    "Emirati": "United Arab Emirates", "Estonian": "Estonia", "Ethiopian": "Ethiopia",
    "Filipino": "Philippines", "Finnish": "Finland", "French": "France", "Georgian": "Georgia",
    "German": "Germany", "Ghanaian": "Ghana", "Greek": "Greece", "Guatemalan": "Guatemala",
    "Honduran": "Honduras", "Hungarian": "Hungary", "Icelandic": "Iceland", "Indian": "India",
    "Indonesian": "Indonesia", "Iranian": "Iran Islamic Republic of", "Iraqi": "Iraq",
    "Irish": "Ireland", "Israeli": "Israel", "Italian": "Italy", "Japanese": "Japan",
    "Jordanian": "Jordan", "Kazakhstani": "Kazakhstan", "Kenyan": "Kenya", "Kuwaiti": "Kuwait",
    "Kyrgyzstani": "Kyrgyzstan", "Latvian": "Latvia", "Lebanese": "Lebanon",
    "Libyan": "Libyan Arab Jamahiriya", "Lithuanian": "Lithuania", "Luxembourger": "Luxembourg",
    "Malaysian": "Malaysia", "Maldivian": "Maldives", "Maltese": "Malta", "Mexican": "Mexico",
    "Moldovan": "Moldova", "Mongolian": "Mongolia", "Moroccan": "Morocco", "Nepalese": "Nepal",
    "New Zealander": "New Zealand", "Nigerian": "Nigeria",
    "North Korean": "Democratic Peoples Republic of Korea", "Norwegian": "Norway", "Omani": "Oman",
    "Pakistani": "Pakistan", "Palestinian": "Palestinian", "Panamanian": "Panama",
    "Peruvian": "Peru", "Polish": "Poland", "Portuguese": "Portugal", "Qatari": "Qatar",
    "Romanian": "Romania", "Russian": "Russian Federation", "Saudi": "Saudi Arabia",
    "Serbian": "Serbia", "Singaporean": "Singapore", "Slovak": "Slovakia", "Slovenian": "Slovenia",
    "Somali": "Somalia", "South African": "South Africa", "South Korean": "Republic of Korea",
    "Spanish": "Spain", "Sri Lankan": "Sri Lanka", "Sudanese": "Sudan", "Swedish": "Sweden",
    "Swiss": "Switzerland", "Syrian": "Syrian Arab Republic", "Taiwanese": "China",
    "Tajikistani": "Tajikistan", "Tanzanian": "United Republic of Tanzania", "Thai": "Thailand",
    "Tunisian": "Tunisia", "Turkish": "Turkey", "Turkmen": "Turkmenistan", "Ugandan": "Uganda",
    "Ukrainian": "Ukraine", "Uruguayan": "Uruguay", "Uzbekistani": "Uzbekistan",
    "Venezuelan": "Venezuela Bolivarian Republic", "Vietnamese": "Viet Nam",
    "Yemeni": "Yemen", "Zambian": "Zambia", "Zimbabwean": "Zimbabwe",
}

PASSPORT_NO_OCR_FIXES = {
    "2": "Z",
    "0": "O",
    "1": "I",
    "5": "S",
    "8": "B",
}


def normalize_date(value: str) -> str:
    if not value:
        return ""
    value = value.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return value

    for sep in ("/", "-", "."):
        if sep in value:
            parts = value.split(sep)
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                day, month, year = parts
                if len(year) == 2:
                    year = f"19{year}" if int(year) > 30 else f"20{year}"
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    return value


def _normalize_passport_no(passport_no: str) -> str:
    if not passport_no:
        return passport_no

    passport_no = passport_no.replace("<", "").strip().upper()

    if passport_no and passport_no[0].isdigit() and passport_no[0] in PASSPORT_NO_OCR_FIXES:
        if re.match(r"^[0-9]{7,8}", passport_no[1:]):
            passport_no = PASSPORT_NO_OCR_FIXES[passport_no[0]] + passport_no[1:]

    # Indian passports: 1 letter + 7 digits (OCR may include check digit as 9th char)
    if re.match(r"^[A-Z][0-9]{8}$", passport_no):
        passport_no = passport_no[0] + passport_no[1:8]

    return passport_no


def normalize_mrz_line(line: str, is_line2: bool = False) -> str:
    clean = line.replace(" ", "").upper()
    if len(clean) < 30:
        return clean

    if len(clean) < 44:
        clean = clean + ("<" * (44 - len(clean)))
    elif len(clean) > 44:
        clean = clean[:44]

    if is_line2 and clean:
        passport_part = clean[:9].replace("<", "")
        if passport_part and passport_part[0].isdigit():
            first_char = passport_part[0]
            if first_char in PASSPORT_NO_OCR_FIXES and re.match(
                r"^[0-9]{7}", passport_part[1:]
            ):
                passport_part = PASSPORT_NO_OCR_FIXES[first_char] + passport_part[1:]
                clean = passport_part.ljust(9, "<") + clean[9:]

    return clean


def parse_mrz(text: str) -> dict:
    data = {}
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    mrz_lines = []
    for line in lines:
        if "<" in line and len(line.replace(" ", "")) >= 30:
            mrz_lines.append(line.replace(" ", ""))

    if len(mrz_lines) < 2:
        return data

    line1 = normalize_mrz_line(mrz_lines[0], is_line2=False)
    line2 = normalize_mrz_line(mrz_lines[1], is_line2=True)

    if line1.startswith("P"):
        name_part = line1[5:] if len(line1) > 5 else ""
        if "<<" in name_part:
            parts = name_part.split("<<")
            surname = parts[0].replace("<", " ").strip()
            given_names = parts[1].replace("<", " ").strip() if len(parts) > 1 else ""
            data["surname_en"] = surname.title()
            data["first_name_en"] = given_names.title() if given_names else ""

    if len(line2) >= 28:
        passport_no = _normalize_passport_no(line2[0:9])
        data["passport_no"] = passport_no

        nationality_code = line2[10:13].replace("<", "")
        data["nationality_code"] = nationality_code

        dob = line2[13:19]
        if dob and len(dob) == 6 and dob.isdigit():
            year = int(dob[0:2])
            year = 1900 + year if year > 30 else 2000 + year
            data["birth_date"] = f"{year}-{dob[2:4]}-{dob[4:6]}"

        gender = line2[20:21]
        if gender == "0":
            gender = "M"
        if gender == "M":
            data["gender"] = "Male"
        elif gender == "F":
            data["gender"] = "Female"

        exp = line2[21:27]
        if exp and len(exp) == 6 and exp.isdigit():
            year = 2000 + int(exp[0:2])
            data["expiry_date"] = f"{year}-{exp[2:4]}-{exp[4:6]}"

    return data


def _clean_name(value: str) -> str:
    value = re.sub(r"\s+", " ", value.strip())
    return value.title()


def _parse_visual_dates(text: str) -> dict:
    result = {}
    for match in re.finditer(r"(\d{1,2}/\d{1,2}/\d{4})", text):
        norm = normalize_date(match.group(1))
        try:
            year = int(norm[:4])
        except ValueError:
            continue
        if year < 2000 and not result.get("birth_date"):
            result["birth_date"] = norm
        elif year >= 2030 and not result.get("expiry_date"):
            result["expiry_date"] = norm
        elif 2020 <= year < 2030 and not result.get("issue_date"):
            result["issue_date"] = norm
    return result


def _parse_visual_place(text_upper: str) -> str:
    issue_match = re.search(
        r"PLACE\s*[O0][FHIL1\s]*(?:ISSUE|SSUG|ISSU)",
        text_upper,
    )
    if issue_match:
        section = text_upper[issue_match.start() : issue_match.start() + 200]
    else:
        idx = text_upper.rfind("PLACE")
        section = text_upper[idx : idx + 200] if idx >= 0 else text_upper

    for city in CITY_TO_COUNTRY:
        if city == "MUMBAI":
            pattern = r"MUMBA\s*I|MUMBAI"
        else:
            pattern = city.replace(" ", r"\s*")
        if re.search(pattern, section):
            return "Mumbai" if city == "MUMBAI" else city.title()
    return ""


def _parse_visual_gender(text_upper: str) -> str:
    sex_match = re.search(
        r"SEX[^\n]{0,40}(MALE|FEMALE|\bM\b|\bF\b)",
        text_upper,
    )
    if sex_match:
        token = sex_match.group(1)
        if token in ("M", "MALE"):
            return "Male"
        if token in ("F", "FEMALE"):
            return "Female"

    mrz_gender = re.search(r"\d{6}(\d)([MF])\d{6}", text_upper.replace(" ", ""))
    if mrz_gender:
        return "Male" if mrz_gender.group(2) == "M" else "Female"
    return ""


_NAME_STOPLIST = {
    "NAME", "OF", "THE", "IND", "INDIAN", "LEGAL", "GUARDIAN", "LEGALGUARDIAN",
    "FATHER", "MOTHER", "SPOUSE", "ADDRESS", "PASSPORT", "DATE", "PLACE", "ISSUE",
    "EXPIRY", "BIRTH", "TYPE", "CODE", "NATIONALITY", "SURNAME", "GIVEN", "SEX",
    "MALE", "FEMALE", "ELPA", "ETPA", "NMOE", "THI", "FAL", "KAM", "HME", "NAMEF",
}


def _extract_family_name(text_upper: str, role: str) -> str:
    if role == "father":
        start_match = re.search(
            r"NAME\s*OF\s*FATHER\s*/\s*LEGAL\s*GUARDIAN|LEGAL\s*GUARDIAN",
            text_upper,
        )
        end_pattern = r"NAME\s*[O0]F\s*MOTHER"
    else:
        start_match = re.search(r"NAME\s*[O0]F\s*MOTHER", text_upper)
        end_pattern = r"(?:SPOUSE|ADDRESS|OLD\s*PASSPORT)"

    if not start_match:
        return ""

    start = start_match.end()
    end_match = re.search(end_pattern, text_upper[start:])
    end = start + end_match.start() if end_match else len(text_upper)

    words = []
    for line in text_upper[start:end].split("\n"):
        token = re.sub(r"[^A-Z]", "", line.strip().upper())
        if len(token) >= 3 and token not in _NAME_STOPLIST and token.isalpha():
            words.append(token)
        if len(words) >= 4:
            break

    return _clean_name(" ".join(words[:4])) if words else ""


def parse_passport_text(text: str) -> dict:
    data = {}
    text_upper = text.upper()

    mrz_data = parse_mrz(text)
    if mrz_data:
        data.update(mrz_data)

    visual_passport_no = None
    passport_match = re.search(
        r"PASSPORT\s*NO\.?\s*[:\s]*([A-Z][0-9]{7,8})",
        text_upper,
    )
    if passport_match:
        visual_passport_no = passport_match.group(1)

    if visual_passport_no:
        mrz_passport = data.get("passport_no", "")
        if not mrz_passport or (
            mrz_passport and mrz_passport[0].isdigit() and visual_passport_no[0].isalpha()
        ):
            data["passport_no"] = visual_passport_no

    patterns = {
        "issue_date": [
            r"DATE\s*OF\s*ISSUE[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        ],
        "expiry_date": [
            r"DATE\s*OF\s*EXPIRY[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
            r"EXPIRY[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        ],
        "birth_date": [
            r"DATE\s*OF\s*BIRTH[:\s]*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
        ],
        "place_of_issue": [
            r"PLACE\s*OF\s*ISSUE[:\s]*([A-Z]{4,})",
        ],
        "father_name_en": [
            r"NAME\s*OF\s*FATHER(?:\s*/\s*LEGAL\s*GUARDIAN)?[:\s]*([A-Z][A-Z\s]+?)(?:\s+NAME\s*OF|\s*$)",
            r"FATHER(?:'S)?\s*NAME[:\s]*([A-Z][A-Z\s]+?)(?:\s+NAME\s*OF|\s*$)",
        ],
        "mother_name_en": [
            r"NAME\s*OF\s*MOTHER[:\s]*([A-Z][A-Z\s]+?)(?:\s+NAME\s*OF|\s*$)",
            r"MOTHER(?:'S)?\s*NAME[:\s]*([A-Z][A-Z\s]+?)(?:\s+NAME\s*OF|\s*$)",
        ],
    }

    for field, field_patterns in patterns.items():
        if field not in data or not data[field]:
            for pattern in field_patterns:
                match = re.search(pattern, text_upper)
                if match:
                    value = _clean_name(match.group(1))
                    if field.endswith("_date"):
                        value = normalize_date(value)
                    elif field == "place_of_issue" and not _is_valid_place(value):
                        continue
                    data[field] = value
                    break

    visual_dates = _parse_visual_dates(text)
    for field, value in visual_dates.items():
        if not data.get(field):
            data[field] = value

    if not data.get("place_of_issue"):
        place = _parse_visual_place(text_upper)
        if place:
            data["place_of_issue"] = place

    if not data.get("gender"):
        gender = _parse_visual_gender(text_upper)
        if gender:
            data["gender"] = gender

    if not data.get("father_name_en"):
        father = _extract_family_name(text_upper, "father")
        if father:
            data["father_name_en"] = father

    if not data.get("mother_name_en"):
        mother = _extract_family_name(text_upper, "mother")
        if mother:
            data["mother_name_en"] = mother

    return data


def _is_valid_place(value: Optional[str]) -> bool:
    if not value:
        return False
    upper = value.upper().strip()
    if upper in PLACE_BLOCKLIST:
        return False
    if upper in CITY_TO_COUNTRY or upper in KNOWN_COUNTRIES:
        return True
    if len(upper) < 4:
        return False
    return upper.isalpha()


def _country_from_nationality(data: dict) -> str:
    nationality = data.get("nationality", "")
    if not nationality:
        code = data.get("nationality_code", "")
        if code:
            nationality = COUNTRY_TO_NATIONALITY.get(code.upper(), "")
    return NATIONALITY_TO_COUNTRY.get(nationality, "")


def map_place_to_country(place: Optional[str]) -> str:
    if not place or not _is_valid_place(place):
        return ""
    upper = place.upper().strip()
    if upper in CITY_TO_COUNTRY:
        return CITY_TO_COUNTRY[upper]
    if upper in KNOWN_COUNTRIES:
        return place.strip()
    for city, country in CITY_TO_COUNTRY.items():
        if city in upper:
            return country
    cleaned = place.strip()
    if cleaned in KNOWN_COUNTRIES:
        return cleaned
    return ""


def map_extracted_fields(raw: dict) -> dict:
    data = dict(raw)

    for field in ("birth_date", "expiry_date", "issue_date"):
        if data.get(field):
            data[field] = normalize_date(str(data[field]))

    code = data.get("nationality_code", "")
    if code and not data.get("nationality"):
        data["nationality"] = COUNTRY_TO_NATIONALITY.get(code.upper(), "")

    if data.get("place_of_issue"):
        mapped = map_place_to_country(data["place_of_issue"])
        data["place_of_issue"] = mapped if mapped else ""

    if not data.get("place_of_issue"):
        fallback_country = _country_from_nationality(data)
        if fallback_country:
            data["place_of_issue"] = fallback_country

    if data.get("place_of_issue") and not data.get("country_of_residence"):
        data["country_of_residence"] = data["place_of_issue"]
    elif not data.get("country_of_residence"):
        fallback_country = _country_from_nationality(data)
        if fallback_country:
            data["country_of_residence"] = fallback_country

    for name_field in (
        "first_name_en",
        "surname_en",
        "father_name_en",
        "mother_name_en",
        "grandfather_name_en",
    ):
        if data.get(name_field):
            data[name_field] = _clean_name(data[name_field])

    arabic = ArabicNameGenerator.transliterate_full_name(
        first_name_en=data.get("first_name_en"),
        father_name_en=data.get("father_name_en"),
        grandfather_name_en=data.get("grandfather_name_en"),
        surname_en=data.get("surname_en"),
        mother_name_en=data.get("mother_name_en"),
    )
    data.update(arabic)

    return data
