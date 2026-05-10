# services/phone_service.py
import re
import csv
import random
import logging
from datetime import datetime, timezone
from models import db, PhoneTracking

logger = logging.getLogger(__name__)

PHONE_CSV_FILE = 'phone_numbers.csv'


def load_phone_numbers_from_csv():
    """Load all phone numbers from CSV file"""
    phone_numbers = []
    try:
        with open(PHONE_CSV_FILE, 'r', newline='', encoding='utf-8') as f:
            reader = csv.reader(f)
            for row in reader:
                if row and row[0].strip():
                    phone = re.sub(r'\D', '', row[0].strip())
                    if len(phone) == 10:
                        phone_numbers.append(phone)
    except FileNotFoundError:
        logger.warning(f'Phone CSV file not found: {PHONE_CSV_FILE}')
    except Exception as e:
        logger.error(f'Error loading phones from CSV: {e}')
    return phone_numbers


def get_available_phones():
    """Get list of phones NOT marked as used in database"""
    all_phones = load_phone_numbers_from_csv()

    if not all_phones:
        return []

    used_phones = {
        pt.phone for pt in PhoneTracking.query.filter_by(is_used=True).all()
    }
    available = [p for p in all_phones if p not in used_phones]

    return available


def get_random_phone(exclude_list=None):
    """Get a random available phone number"""
    available_phones = get_available_phones()

    if not available_phones:
        all_phones = load_phone_numbers_from_csv()
        if all_phones:
            logger.info('🔄 All phones used - RESTARTING CYCLE')
            PhoneTracking.query.update({'is_used': False, 'used_at': None})
            db.session.commit()
            available_phones = all_phones
        else:
            return None, 'No phone numbers found in CSV'

    if exclude_list:
        exclude_set = set()
        for phone in exclude_list:
            if phone and isinstance(phone, str):
                clean_phone = re.sub(r'\D', '', phone.strip())
                if len(clean_phone) == 10:
                    exclude_set.add(clean_phone)

        available_phones = [p for p in available_phones if p not in exclude_set]

    if not available_phones:
        return None, 'No available phone numbers (all excluded)'

    selected_phone = random.choice(available_phones)
    logger.debug(f'📱 Random phone selected: {selected_phone}')

    return selected_phone, None


def mark_phones_as_used(phone_numbers):
    """Mark phone numbers as PERMANENTLY USED in database"""
    if not phone_numbers:
        return 0

    marked_count = 0

    for phone in phone_numbers:
        if phone and isinstance(phone, str):
            phone = re.sub(r'\D', '', phone.strip())

            if len(phone) == 10:
                existing = PhoneTracking.query.filter_by(phone=phone).first()

                if existing:
                    if not existing.is_used:
                        existing.is_used = True
                        existing.used_at = datetime.now(timezone.utc)
                        marked_count += 1
                else:
                    pt = PhoneTracking(
                        phone=phone,
                        is_used=True,
                        used_at=datetime.now(timezone.utc)
                    )
                    db.session.add(pt)
                    marked_count += 1

    if marked_count > 0:
        db.session.commit()
        logger.info(f'🔒 Marked {marked_count} phones as USED: {phone_numbers}')

    return marked_count


def get_phone_stats():
    """Get phone number statistics"""
    all_phones = load_phone_numbers_from_csv()
    used_count = PhoneTracking.query.filter_by(is_used=True).count()
    available = len(all_phones) - used_count

    return {
        'total': len(all_phones),
        'used': used_count,
        'available': max(0, available)
    }


def reset_phone_tracking():
    """Reset all phone tracking"""
    try:
        PhoneTracking.query.update({'is_used': False, 'used_at': None})
        db.session.commit()
        logger.info('🔄 Phone tracking reset')
        return True, 'Phone tracking reset successfully'
    except Exception as e:
        db.session.rollback()
        logger.error(f'Error resetting phone tracking: {e}')
        return False, str(e)