# routes/drafts.py
import re
import logging
import zipfile
from io import BytesIO
from datetime import datetime, timezone
from flask import (
    Blueprint, request, jsonify,
    session, send_file
)
from models import db, User, Draft
from config import TEMPLATE_CONFIG
from routes.auth import login_required
from services.document_service import (
    generate_documents_to_memory,
    get_cd_document_content,
    prepare_replacements
)
from services.phone_service import mark_phones_as_used
from helpers.text_helpers import resolve_he_she

logger = logging.getLogger(__name__)

drafts_bp = Blueprint('drafts', __name__)


@drafts_bp.route('/api/drafts', methods=['GET'])
@login_required
def api_get_drafts():
    """Get user's drafts"""
    try:
        user_id = session.get('user_id')
        status = request.args.get('status')

        query = Draft.query.filter_by(user_id=user_id).order_by(
            Draft.modified_at.desc()
        )
        if status:
            query = query.filter_by(status=status)

        drafts = query.all()
        return jsonify({'success': True, 'drafts': [d.to_dict() for d in drafts]})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts', methods=['POST'])
@login_required
def api_create_draft():
    """Create a new draft"""
    try:
        user_id = session.get('user_id')
        data = request.json

        template_type = data.get('template_type')
        template_config = TEMPLATE_CONFIG.get(template_type, {})

        new_draft = Draft(
            user_id=user_id,
            template_type=template_type,
            template_name=template_config.get('name', template_type),
            old_name=data.get('replacements', {}).get('OLD_NAME', ''),
            replacements=data.get('replacements', {}),
            preview_data=data.get('preview_data', {}),
            status='draft'
        )

        db.session.add(new_draft)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Draft saved successfully',
            'draft': new_draft.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/<draft_id>', methods=['GET'])
@login_required
def api_get_draft(draft_id):
    """Get a specific draft"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'})

        return jsonify({'success': True, 'draft': draft.to_dict()})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/<draft_id>', methods=['PUT'])
@login_required
def api_update_draft(draft_id):
    """Update a draft"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'})

        data = request.json

        if 'replacements' in data:
            draft.replacements = data['replacements']
            draft.old_name = data['replacements'].get('OLD_NAME', draft.old_name)

        if 'preview_data' in data:
            draft.preview_data = data['preview_data']

        if 'folder_type' in data:
            preview_data = draft.preview_data or {}
            template_type = draft.template_type
            if template_type in TEMPLATE_CONFIG:
                config = TEMPLATE_CONFIG[template_type]
                if data['folder_type'] == 'unmarried' and 'unmarried_subfolder' in config:
                    preview_data['template_folder'] = config['unmarried_subfolder']
                    preview_data['folder_type'] = 'unmarried'
                else:
                    preview_data['template_folder'] = config['folder']
                    preview_data['folder_type'] = 'main'
            draft.preview_data = preview_data

        draft.modified_at = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Draft updated successfully',
            'draft': draft.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/<draft_id>', methods=['DELETE'])
@login_required
def api_delete_draft(draft_id):
    """Delete a draft"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'})

        db.session.delete(draft)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Draft deleted successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/<draft_id>/approve', methods=['POST'])
@login_required
def api_approve_draft(draft_id):
    """Approve a draft"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'})

        draft.status = 'approved'
        draft.approved_at = datetime.now(timezone.utc)
        draft.modified_at = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Draft approved successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/<draft_id>/submit-approval', methods=['POST'])
@login_required
def api_submit_for_approval(draft_id):
    """User submits draft for admin approval"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Draft not found'}), 404

        if draft.status not in ['draft', 'pending']:
            return jsonify({
                'success': False,
                'message': 'Cannot submit this document'
            }), 400

        draft.status = 'pending'
        draft.modified_at = datetime.now(timezone.utc)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Document submitted for approval successfully!'
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error submitting for approval: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500


@drafts_bp.route('/api/drafts/stats')
@login_required
def api_draft_stats():
    """Get draft statistics for current user"""
    try:
        user_id = session.get('user_id')

        stats = {
            'drafts': Draft.query.filter_by(
                user_id=user_id, status='draft'
            ).count(),
            'pending': Draft.query.filter_by(
                user_id=user_id, status='pending'
            ).count(),
            'approved': Draft.query.filter_by(
                user_id=user_id, status='approved'
            ).count(),
            'generated': Draft.query.filter_by(
                user_id=user_id, status='generated'
            ).count()
        }
        stats['total'] = sum(stats.values())

        return jsonify({'success': True, 'stats': stats})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@drafts_bp.route('/api/drafts/save', methods=['POST'])
@login_required
def api_save_draft_from_preview():
    """Save a new draft and mark phones as used"""
    try:
        user_id = session.get('user_id')
        data = request.json

        replacements = data.get('replacements', {})
        template_type = data.get('template_type', '')
        preview_data = data.get('preview_data', {})
        folder_type = data.get('folder_type', 'main')

        if 'preview_data' in session and not replacements:
            session_preview = session['preview_data']
            replacements = session_preview.get('replacements', {})
            template_type = session_preview.get('template_type', template_type)
            preview_data = session_preview
            folder_type = session_preview.get('folder_type', folder_type)

        if not template_type:
            return jsonify({
                'success': False,
                'message': 'Template type is required'
            })

        if not replacements:
            return jsonify({'success': False, 'message': 'No data to save'})

        if 'WIFE_OF' not in replacements:
            replacements['WIFE_OF'] = ''
        if 'SPOUSE_NAME1' not in replacements:
            replacements['SPOUSE_NAME1'] = ''

        son_daughter = replacements.get('SON-DAUGHTER', '').strip()
        gender = replacements.get('GENDER_UPDATE', '').strip()
        existing_he_she = replacements.get('HE_SHE', '').strip()
        replacements['HE_SHE'] = resolve_he_she(
            son_daughter=son_daughter,
            gender=gender,
            existing=existing_he_she
        )

        phones_to_mark = []
        phone_fields = ['PHONE_UPDATE', 'WITNESS_PHONE1', 'WITNESS_PHONE2']

        for field in phone_fields:
            phone = replacements.get(field, '')
            if phone and isinstance(phone, str):
                phone = re.sub(r'\D', '', phone.strip())
                if len(phone) == 10 and phone not in phones_to_mark:
                    phones_to_mark.append(phone)

        template_config = TEMPLATE_CONFIG.get(template_type, {})

        if not preview_data:
            preview_data = {}

        preview_data['folder_type'] = folder_type
        preview_data['replacements'] = replacements
        preview_data['phones_used'] = phones_to_mark

        if folder_type == 'unmarried' and 'unmarried_subfolder' in template_config:
            preview_data['template_folder'] = template_config['unmarried_subfolder']
        else:
            preview_data['template_folder'] = template_config.get('folder', '')

        new_draft = Draft(
            user_id=user_id,
            template_type=template_type,
            template_name=template_config.get('name', template_type),
            old_name=replacements.get('OLD_NAME', 'Unnamed'),
            replacements=replacements,
            preview_data=preview_data,
            status='draft'
        )

        db.session.add(new_draft)
        db.session.commit()

        marked_count = 0
        if phones_to_mark:
            marked_count = mark_phones_as_used(phones_to_mark)

        session.pop('preview_data', None)

        return jsonify({
            'success': True,
            'message': 'Draft saved successfully',
            'draft_id': new_draft.id,
            'phones_marked': marked_count
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f'Save draft error: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@drafts_bp.route('/api/drafts/<draft_id>/cd-preview', methods=['GET'])
@login_required
def api_get_user_cd_preview(draft_id):
    """Get CD preview for user"""
    try:
        user_id = session.get('user_id')
        draft = Draft.query.filter_by(id=draft_id, user_id=user_id).first()

        if not draft:
            return jsonify({'success': False, 'message': 'Document not found'}), 404

        preview_data = draft.preview_data or {}
        template_folder = preview_data.get('template_folder')

        if not template_folder:
            template_config = TEMPLATE_CONFIG.get(draft.template_type, {})
            folder_type = preview_data.get('folder_type', 'main')
            if folder_type == 'unmarried' and 'unmarried_subfolder' in template_config:
                template_folder = template_config['unmarried_subfolder']
            else:
                template_folder = template_config.get('folder', '')

        if not template_folder:
            return jsonify({
                'success': False,
                'message': 'Template folder not configured'
            }), 400

        replacements = prepare_replacements(draft.replacements or {})
        cd_content = get_cd_document_content(template_folder, replacements)

        return jsonify({
            'success': True,
            'cd_content': cd_content,
            'document_name': draft.old_name or 'Unnamed'
        })

    except Exception as e:
        logger.error(f'Error getting CD preview: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500


@drafts_bp.route('/api/dashboard/stats')
@login_required
def api_dashboard_stats():
    """Get dashboard statistics for current user"""
    try:
        user_id = session.get('user_id')

        stats = {
            'drafts': Draft.query.filter_by(
                user_id=user_id, status='draft'
            ).count(),
            'pending': Draft.query.filter_by(
                user_id=user_id, status='pending'
            ).count(),
            'approved': Draft.query.filter_by(
                user_id=user_id, status='approved'
            ).count(),
            'generated': Draft.query.filter_by(
                user_id=user_id, status='generated'
            ).count()
        }

        return jsonify({'success': True, 'stats': stats})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})