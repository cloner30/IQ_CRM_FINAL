from typing import Optional

ENGLISH_TO_ARABIC = {
    "sh": "ش",
    "ch": "چ",
    "th": "ث",
    "gh": "غ",
    "kh": "خ",
    "dh": "ذ",
    "ph": "ف",
    "aa": "ا",
    "a": "ا",
    "b": "ب",
    "c": "ك",
    "d": "د",
    "e": "ي",
    "f": "ف",
    "g": "غ",
    "h": "ح",
    "i": "ي",
    "j": "ج",
    "k": "ك",
    "l": "ل",
    "m": "م",
    "n": "ن",
    "o": "و",
    "p": "پ",
    "q": "ق",
    "r": "ر",
    "s": "س",
    "t": "ت",
    "u": "و",
    "v": "ف",
    "w": "و",
    "x": "كس",
    "y": "ي",
    "z": "ز",
}

COMMON_NAMES_TO_ARABIC = {
    "Rajesh": "راجيش",
    "Amit": "أميت",
    "Priya": "برييا",
    "Deepak": "ديباك",
    "Shreya": "شريا",
    "Arun": "أرون",
    "Nisha": "نيشا",
    "Manish": "مانيش",
    "Pooja": "بوجا",
    "Sandeep": "سانديب",
    "Vikram": "فيكرام",
    "Anita": "أنيتا",
    "Sanjay": "سانجاي",
    "Neha": "نيها",
    "Muhammad": "محمد",
    "Ali": "علي",
    "Hassan": "حسن",
    "Fatima": "فاطمة",
    "Ayesha": "عائشة",
    "Omar": "عمر",
    "Zainab": "زينب",
    "Abdullah": "عبدالله",
    "Ahmed": "أحمد",
    "Hanan": "حنان",
    "Jamila": "جميلة",
    "Karim": "كريم",
    "Layla": "ليلى",
    "Mariam": "مريم",
    "Nasir": "ناصر",
    "Rashid": "رشيد",
    "Samir": "سمير",
    "Tariq": "طارق",
    "Waleed": "وليد",
    "Yasmin": "ياسمين",
    "John": "جون",
    "James": "جيمس",
    "David": "ديفيد",
    "Michael": "مايكل",
    "Robert": "روبرت",
    "William": "ويليام",
    "Richard": "ريتشارد",
    "Joseph": "جوزيف",
    "Thomas": "توماس",
    "Charles": "تشارلز",
    "Mary": "ماري",
    "Patricia": "باتريشيا",
    "Jennifer": "جينيفر",
    "Linda": "ليندا",
    "Barbara": "باربرا",
    "Elizabeth": "إليزابيث",
    "Susan": "سوزان",
    "Jessica": "جيسيكا",
    "Sarah": "سارة",
    "Karen": "كارين",
    "Khan": "خان",
    "Kumar": "كومار",
    "Singh": "سينغ",
    "Virani": "فيراني",
    "Mazaherali": "مظاهر علي",
    "Pyarali": "بيار علي",
    "Mumtaz": "ممتاز",
    "Ashraf": "أشرف",
    "Banoo": "بانو",
    "Alladin": "علاء الدين",
}


class ArabicNameGenerator:
    @staticmethod
    def transliterate_name(english_name: str) -> str:
        english_name = (english_name or "").strip()
        if not english_name:
            return ""

        if english_name in COMMON_NAMES_TO_ARABIC:
            return COMMON_NAMES_TO_ARABIC[english_name]

        lower_name = english_name.lower()
        for name, arabic in COMMON_NAMES_TO_ARABIC.items():
            if lower_name == name.lower():
                return arabic

        words = english_name.split()
        if len(words) > 1:
            return " ".join(
                ArabicNameGenerator.transliterate_name(word) for word in words if word
            )

        return ArabicNameGenerator._char_by_char(english_name)

    @staticmethod
    def _char_by_char(name: str) -> str:
        name = name.lower()
        arabic = ""
        i = 0

        while i < len(name):
            if i < len(name) - 1:
                digraph = name[i : i + 2]
                if digraph in ENGLISH_TO_ARABIC:
                    arabic += ENGLISH_TO_ARABIC[digraph]
                    i += 2
                    continue

            char = name[i]
            if char in ENGLISH_TO_ARABIC:
                arabic += ENGLISH_TO_ARABIC[char]
            elif char == " ":
                arabic += " "
            i += 1

        return arabic if arabic else name

    @staticmethod
    def transliterate_full_name(
        first_name_en: Optional[str] = None,
        father_name_en: Optional[str] = None,
        grandfather_name_en: Optional[str] = None,
        surname_en: Optional[str] = None,
        mother_name_en: Optional[str] = None,
    ) -> dict:
        result = {}
        if first_name_en:
            result["first_name_ar"] = ArabicNameGenerator.transliterate_name(first_name_en)
        if father_name_en:
            result["father_name_ar"] = ArabicNameGenerator.transliterate_name(father_name_en)
        if grandfather_name_en:
            result["grandfather_name_ar"] = ArabicNameGenerator.transliterate_name(
                grandfather_name_en
            )
        if surname_en:
            result["surname_ar"] = ArabicNameGenerator.transliterate_name(surname_en)
        if mother_name_en:
            result["mother_name_ar"] = ArabicNameGenerator.transliterate_name(mother_name_en)
        if result:
            result["arabic_names_suggested"] = True
        return result
