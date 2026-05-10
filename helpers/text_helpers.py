# helpers/text_helpers.py
import re
import random
from datetime import datetime


def to_uppercase(value):
    if isinstance(value, str):
        return value.upper().strip()
    return value


def to_uppercase_preserve_alias(value):
    if not isinstance(value, str):
        return value

    value = value.strip()
    if not value:
        return value

    parts = re.split(r'\s+alias\s+', value, flags=re.IGNORECASE)
    uppercased_parts = [part.strip().upper() for part in parts if part.strip()]

    return ' alias '.join(uppercased_parts)


def format_date_to_ddmmyyyy(date_string):
    if not date_string:
        return ''
    try:
        date_obj = datetime.strptime(date_string, '%Y-%m-%d')
        return date_obj.strftime('%d/%m/%Y')
    except ValueError:
        return date_string


def generate_email_from_name(name):
    if not name:
        return ''

    if ' alias ' in name.lower():
        name = re.split(r'\s+alias\s+', name, flags=re.IGNORECASE)[0].strip()

    clean_name = re.sub(r'[^a-zA-Z]', '', name).lower()

    if not clean_name:
        return ''

    random_digits = str(random.randint(10, 999))
    return f"{clean_name}{random_digits}@gmail.com"


def create_safe_folder_name(name):
    if not name:
        return 'unnamed'
    if ' alias ' in name.lower():
        name = re.split(r'\s+alias\s+', name, flags=re.IGNORECASE)[0].strip()
    safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
    return safe_name if safe_name else 'unnamed'


GENDER_PRONOUNS = {
    'son': {'HE_SHE': 'he'},
    'daughter': {'HE_SHE': 'she'}
}

GENDER_PRONOUNS_BY_GENDER = {
    'male': {'HE_SHE': 'he'},
    'female': {'HE_SHE': 'she'}
}


def resolve_he_she(son_daughter=None, gender=None, existing=None):
    """
    Single source of truth for HE_SHE resolution.
    Priority: son_daughter > gender > existing > default
    """
    if son_daughter:
        sd = son_daughter.lower().strip()
        if sd == 'son':
            return 'he'
        elif sd == 'daughter':
            return 'she'

    if gender:
        g = gender.lower().strip()
        if g == 'male':
            return 'he'
        elif g == 'female':
            return 'she'

    if existing and str(existing).strip() in ('he', 'she'):
        return existing

    return 'he/she'


def get_gender_pronouns(son_daughter=None, gender=None):
    pronouns = {}

    if son_daughter:
        son_daughter_lower = son_daughter.lower().strip()
        if son_daughter_lower in GENDER_PRONOUNS:
            pronouns = GENDER_PRONOUNS[son_daughter_lower].copy()
    elif gender:
        gender_lower = gender.lower().strip()
        if gender_lower in GENDER_PRONOUNS_BY_GENDER:
            pronouns = GENDER_PRONOUNS_BY_GENDER[gender_lower].copy()

    return pronouns