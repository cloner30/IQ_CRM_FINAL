from arabic_name_generator import ArabicNameGenerator


def test_common_name_muhammad():
    assert ArabicNameGenerator.transliterate_name("Muhammad") == "محمد"


def test_common_name_ali():
    assert ArabicNameGenerator.transliterate_name("Ali") == "علي"


def test_common_name_rajesh():
    assert ArabicNameGenerator.transliterate_name("Rajesh") == "راجيش"


def test_full_name_structure():
    result = ArabicNameGenerator.transliterate_full_name(
        first_name_en="Muhammad",
        father_name_en="Ali",
        surname_en="Khan",
    )
    assert result["first_name_ar"] == "محمد"
    assert result["father_name_ar"] == "علي"
    assert result["surname_ar"] == "خان"
    assert result["arabic_names_suggested"] is True


def test_multi_word_first_name():
    result = ArabicNameGenerator.transliterate_name("Mazaherali Pyarali")
    assert "مظاهر علي" in result
    assert "بيار علي" in result
