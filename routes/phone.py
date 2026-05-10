# routes/phone.py
import logging
from flask import Blueprint, request, jsonify
from routes.auth import admin_required
from services.phone_service import (
    get_random_phone,
    get_phone_stats,
    reset_phone_tracking
)

logger = logging.getLogger(__name__)

phone_bp = Blueprint('phone', __name__)


@phone_bp.route('/api/phone/next', methods=['POST'])
def api_get_next_phone():
    """Get next random available phone number"""
    try:
        data = request.get_json() or {}
        exclude_list = data.get('exclude', [])

        phone, error = get_random_phone(exclude_list)

        if error:
            return jsonify({
                'success': False,
                'message': error,
                'stats': get_phone_stats()
            })

        return jsonify({
            'success': True,
            'phone': phone,
            'stats': get_phone_stats()
        })

    except Exception as e:
        logger.error(f'Error getting phone: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500


@phone_bp.route('/api/phone/stats')
def api_phone_stats():
    """Get phone statistics"""
    return jsonify({'success': True, 'stats': get_phone_stats()})


@phone_bp.route('/api/phone/reset', methods=['POST'])
@admin_required
def api_reset_phone_tracking():
    """Admin: Reset all phone tracking"""
    try:
        success, message = reset_phone_tracking()

        if success:
            return jsonify({
                'success': True,
                'message': message,
                'stats': get_phone_stats()
            })
        else:
            return jsonify({'success': False, 'message': message}), 500

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500