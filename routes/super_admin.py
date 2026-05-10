# routes/super_admin.py
import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, render_template
from models import db, User, Draft
from config import DEFAULT_ADMIN_PASSWORD, DEFAULT_USER_PASSWORD
from routes.auth import super_admin_required

logger = logging.getLogger(__name__)

super_admin_bp = Blueprint('super_admin', __name__)


@super_admin_bp.route('/superadmin/dashboard')
@super_admin_required
def super_admin_dashboard():
    """Super Admin dashboard"""
    user_id = session.get('user_id')
    super_admin = db.session.get(User, user_id)
    return render_template(
        'super_admin_dashboard.html',
        admin=super_admin,
        admin_name=super_admin.name
    )


@super_admin_bp.route('/api/superadmin/stats')
@super_admin_required
def api_super_admin_stats():
    """Get super admin dashboard statistics"""
    try:
        super_admin_count = User.query.filter_by(role='super_admin').count()
        admin_count = User.query.filter_by(role='admin').count()
        user_count = User.query.filter_by(role='user').count()
        active_admins = User.query.filter_by(role='admin', is_active=True).count()
        active_users = User.query.filter_by(role='user', is_active=True).count()
        total_docs = Draft.query.count()
        draft_count = Draft.query.filter_by(status='draft').count()
        pending_count = Draft.query.filter_by(status='pending').count()
        approved_count = Draft.query.filter_by(status='approved').count()
        generated_count = Draft.query.filter_by(status='generated').count()

        admins = User.query.filter_by(role='admin').all()
        admin_stats = []
        for admin in admins:
            admin_stats.append({
                'id': admin.id,
                'name': admin.name,
                'email': admin.email,
                'phone': admin.phone,
                'is_active': admin.is_active,
                'last_login': (
                    admin.last_login.isoformat() if admin.last_login else None
                ),
                'created_at': (
                    admin.created_at.isoformat() if admin.created_at else None
                )
            })

        users = User.query.filter_by(role='user').all()
        user_stats = []
        for user in users:
            user_stats.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone,
                'is_active': user.is_active,
                'last_login': (
                    user.last_login.isoformat() if user.last_login else None
                ),
                'created_at': (
                    user.created_at.isoformat() if user.created_at else None
                ),
                'stats': {
                    'drafts': Draft.query.filter_by(
                        user_id=user.id, status='draft'
                    ).count(),
                    'pending': Draft.query.filter_by(
                        user_id=user.id, status='pending'
                    ).count(),
                    'approved': Draft.query.filter_by(
                        user_id=user.id, status='approved'
                    ).count(),
                    'generated': Draft.query.filter_by(
                        user_id=user.id, status='generated'
                    ).count(),
                    'total': Draft.query.filter_by(user_id=user.id).count()
                }
            })

        return jsonify({
            'success': True,
            'overall': {
                'super_admins': super_admin_count,
                'total_admins': admin_count,
                'active_admins': active_admins,
                'total_users': user_count,
                'active_users': active_users,
                'total_documents': total_docs,
                'drafts': draft_count,
                'pending': pending_count,
                'approved': approved_count,
                'generated': generated_count
            },
            'admins': admin_stats,
            'users': user_stats
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins', methods=['GET'])
@super_admin_required
def api_get_admins():
    """Get all admins"""
    try:
        admins = User.query.filter_by(role='admin').order_by(
            User.created_at.desc()
        ).all()
        return jsonify({'success': True, 'admins': [a.to_dict() for a in admins]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins', methods=['POST'])
@super_admin_required
def api_create_admin():
    """Create a new admin"""
    try:
        name = request.json.get('name', '').strip()
        email = request.json.get('email', '').strip().lower()
        phone = request.json.get('phone', '').strip()
        password = request.json.get('password', DEFAULT_ADMIN_PASSWORD)

        if not name or not email:
            return jsonify({
                'success': False,
                'message': 'Name and email are required'
            })

        if User.get_by_email(email):
            return jsonify({'success': False, 'message': 'Email already exists'})

        admin = User(
            name=name, email=email, phone=phone,
            role='admin', is_active=True,
            created_by=session.get('user_id')
        )
        admin.set_password(password)
        db.session.add(admin)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Admin created successfully',
            'admin': admin.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins/<admin_id>', methods=['PUT'])
@super_admin_required
def api_update_admin(admin_id):
    """Update an admin"""
    try:
        admin = db.session.get(User, admin_id)
        if not admin or admin.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin not found'})

        name = request.json.get('name', '').strip()
        phone = request.json.get('phone', '').strip()
        new_email = request.json.get('email', '').strip().lower()
        new_password = request.json.get('password', '').strip()

        if name:
            admin.name = name
        if phone is not None:
            admin.phone = phone

        if new_email and new_email != admin.email:
            existing = User.get_by_email(new_email)
            if existing and existing.id != admin_id:
                return jsonify({'success': False, 'message': 'Email already exists'})
            admin.email = new_email

        if new_password:
            admin.set_password(new_password)

        db.session.commit()
        return jsonify({'success': True, 'message': 'Admin updated successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins/<admin_id>/toggle', methods=['POST'])
@super_admin_required
def api_toggle_admin(admin_id):
    """Toggle admin active status"""
    try:
        admin = db.session.get(User, admin_id)
        if not admin or admin.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin not found'})

        admin.is_active = not admin.is_active
        db.session.commit()

        status = 'activated' if admin.is_active else 'deactivated'
        return jsonify({
            'success': True,
            'message': f'Admin {status} successfully'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins/<admin_id>', methods=['DELETE'])
@super_admin_required
def api_delete_admin(admin_id):
    """Delete an admin"""
    try:
        admin = db.session.get(User, admin_id)
        if not admin or admin.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin not found'})

        db.session.delete(admin)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Admin deleted successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users', methods=['GET'])
@super_admin_required
def api_super_admin_get_users():
    """Get all users"""
    try:
        users = User.query.filter_by(role='user').order_by(
            User.created_at.desc()
        ).all()
        return jsonify({'success': True, 'users': [u.to_dict() for u in users]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users', methods=['POST'])
@super_admin_required
def api_super_admin_create_user():
    """Create a new user"""
    try:
        name = request.json.get('name', '').strip()
        email = request.json.get('email', '').strip().lower()
        phone = request.json.get('phone', '').strip()
        password = request.json.get('password', DEFAULT_USER_PASSWORD)

        if not name or not email:
            return jsonify({
                'success': False,
                'message': 'Name and email are required'
            })

        if User.get_by_email(email):
            return jsonify({'success': False, 'message': 'Email already exists'})

        user = User(
            name=name, email=email, phone=phone,
            role='user', is_active=True,
            created_by=session.get('user_id')
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': user.to_dict()
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users/<user_id>', methods=['PUT'])
@super_admin_required
def api_super_admin_update_user(user_id):
    """Update a user"""
    try:
        user = db.session.get(User, user_id)
        if not user or user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': 'User not found'})

        name = request.json.get('name', '').strip()
        phone = request.json.get('phone', '').strip()
        new_email = request.json.get('email', '').strip().lower()
        new_password = request.json.get('password', '').strip()

        if name:
            user.name = name
        if phone is not None:
            user.phone = phone

        if new_email and new_email != user.email:
            existing = User.get_by_email(new_email)
            if existing and existing.id != user_id:
                return jsonify({'success': False, 'message': 'Email already exists'})
            user.email = new_email

        if new_password:
            user.set_password(new_password)

        db.session.commit()
        return jsonify({'success': True, 'message': 'User updated successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users/<user_id>/toggle', methods=['POST'])
@super_admin_required
def api_super_admin_toggle_user(user_id):
    """Toggle user active status"""
    try:
        user = db.session.get(User, user_id)
        if not user or user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': 'User not found'})

        user.is_active = not user.is_active
        db.session.commit()

        status = 'activated' if user.is_active else 'deactivated'
        return jsonify({
            'success': True,
            'message': f'User {status} successfully'
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users/<user_id>', methods=['DELETE'])
@super_admin_required
def api_super_admin_delete_user(user_id):
    """Delete a user"""
    try:
        user = db.session.get(User, user_id)
        if not user or user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': 'User not found'})

        db.session.delete(user)
        db.session.commit()
        return jsonify({'success': True, 'message': 'User deleted successfully'})

    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/documents')
@super_admin_required
def api_super_admin_get_documents():
    """Get all documents"""
    try:
        status = request.args.get('status')
        query = Draft.query.order_by(Draft.modified_at.desc())
        if status:
            query = query.filter_by(status=status)
        drafts = query.all()
        return jsonify({
            'success': True,
            'documents': [d.to_dict() for d in drafts]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})