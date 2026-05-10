# routes/auth.py
import re
import logging
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, session, redirect, url_for
from functools import wraps
from models import db, User

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


# ==================== DECORATORS ====================

def login_required(f):
    """Decorator to require login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': 'Login required',
                    'redirect': '/?show_login=true'
                })
            return redirect(url_for('main.index', show_login='true'))
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin or super_admin login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': 'Login required',
                    'redirect': '/login'
                })
            return redirect(url_for('auth.login'))
        if session.get('user_role') not in ['admin', 'super_admin']:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': 'Admin access required'
                })
            return redirect(url_for('dashboard.dashboard'))
        return f(*args, **kwargs)
    return decorated_function


def super_admin_required(f):
    """Decorator to require super_admin login"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': 'Login required',
                    'redirect': '/login'
                })
            return redirect(url_for('auth.login'))
        if session.get('user_role') != 'super_admin':
            if request.is_json:
                return jsonify({
                    'success': False,
                    'message': 'Super Admin access required'
                })
            return redirect(url_for('admin.admin_dashboard'))
        return f(*args, **kwargs)
    return decorated_function


# ==================== ROUTES ====================

@auth_bp.route('/login')
def login():
    """Login page"""
    if 'user_id' in session:
        user_role = session.get('user_role')
        if user_role == 'super_admin':
            return redirect(url_for('super_admin.super_admin_dashboard'))
        elif user_role == 'admin':
            return redirect(url_for('admin.admin_dashboard'))
        else:
            return redirect(url_for('dashboard.dashboard'))
    return redirect(url_for('main.index'))


@auth_bp.route('/logout')
def logout():
    """Logout and redirect to index"""
    session.clear()
    return redirect(url_for('main.index'))


@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login user"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        email = (data.get('email') or '').strip().lower()
        password = (data.get('password') or '').strip()

        if not email or not password:
            return jsonify({
                'success': False,
                'message': 'Email and password are required'
            }), 400

        user = User.get_by_email(email)

        if not user:
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401

        if not user.check_password(password):
            return jsonify({
                'success': False,
                'message': 'Invalid email or password'
            }), 401

        if not user.is_active:
            return jsonify({
                'success': False,
                'message': 'Your account has been deactivated. Please contact support.'
            }), 403

        if user.role == 'user' and not user.is_approved:
            return jsonify({
                'success': False,
                'message': 'Your account is pending admin approval. Please wait for confirmation.'
            }), 403

        user.last_login = datetime.now(timezone.utc)
        db.session.commit()

        session['user_id'] = user.id
        session['user_name'] = user.name
        session['user_email'] = user.email
        session['user_role'] = user.role
        session.permanent = True

        if user.role == 'super_admin':
            redirect_url = '/superadmin/dashboard'
        elif user.role == 'admin':
            redirect_url = '/admin/dashboard'
        else:
            redirect_url = '/dashboard'

        logger.info(f'User logged in: {email} (Role: {user.role})')

        return jsonify({
            'success': True,
            'message': 'Login successful',
            'redirect': redirect_url,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role
            }
        }), 200

    except Exception as e:
        logger.error(f'Login Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': 'An error occurred during login. Please try again.'
        }), 500


@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    """Register a new user"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        name = (data.get('name') or '').strip()
        email = (data.get('email') or '').strip().lower()
        phone = (data.get('phone') or '').strip()
        password = (data.get('password') or '').strip()

        if not name:
            return jsonify({'success': False, 'message': 'Full name is required'}), 400
        if not email:
            return jsonify({'success': False, 'message': 'Email is required'}), 400
        if not re.match(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email
        ):
            return jsonify({
                'success': False,
                'message': 'Please enter a valid email address'
            }), 400
        if not password:
            return jsonify({'success': False, 'message': 'Password is required'}), 400
        if len(password) < 8:
            return jsonify({
                'success': False,
                'message': 'Password must be at least 8 characters long'
            }), 400

        if phone:
            phone = re.sub(r'\D', '', phone)
            if len(phone) != 10:
                return jsonify({
                    'success': False,
                    'message': 'Please enter a valid 10-digit phone number'
                }), 400

        if User.get_by_email(email):
            return jsonify({
                'success': False,
                'message': 'An account with this email already exists'
            }), 409

        if phone:
            existing_phone = User.query.filter_by(phone=phone).first()
            if existing_phone:
                return jsonify({
                    'success': False,
                    'message': 'An account with this phone number already exists'
                }), 409

        new_user = User(
            name=name,
            email=email,
            phone=phone if phone else None,
            role='user',
            is_active=True,
            is_approved=False
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        logger.info(f'New user registered (pending approval): {email}')

        return jsonify({
            'success': True,
            'message': (
                'Account created successfully! '
                'Please wait for admin approval before logging in.'
            ),
            'user': {
                'id': new_user.id,
                'name': new_user.name,
                'email': new_user.email,
                'phone': new_user.phone,
                'is_approved': new_user.is_approved
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f'Registration Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Registration error: {str(e)}'
        }), 500


@auth_bp.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """API endpoint for logout"""
    session.clear()
    return jsonify({
        'success': True,
        'message': 'Logged out successfully',
        'redirect': '/'
    })


@auth_bp.route('/api/auth/check')
def api_check_auth():
    """Check if user is authenticated"""
    if 'user_id' in session:
        user = db.session.get(User, session.get('user_id'))
        if user:
            return jsonify({
                'success': True,
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'name': user.name,
                    'email': user.email,
                    'role': user.role
                }
            })

    session.clear()
    return jsonify({
        'success': True,
        'authenticated': False,
        'user': None
    })


@auth_bp.route('/api/user/profile', methods=['GET'])
def api_get_user_profile():
    """Get current user profile"""
    try:
        user_id = session.get('user_id')
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone or '',
                'role': user.role
            }
        })
    except Exception as e:
        logger.error(f'Error getting profile: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500


@auth_bp.route('/api/user/profile', methods=['PUT'])
def api_update_user_profile():
    """Update current user profile"""
    try:
        user_id = session.get('user_id')
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404

        data = request.get_json()

        if 'name' in data and data['name'].strip():
            user.name = data['name'].strip()
            session['user_name'] = user.name

        if 'email' in data and data['email'].strip():
            new_email = data['email'].strip().lower()
            if new_email != user.email:
                existing = User.get_by_email(new_email)
                if existing:
                    return jsonify({
                        'success': False,
                        'message': 'Email already exists'
                    }), 400
                user.email = new_email
                session['user_email'] = new_email

        if 'phone' in data:
            phone = data['phone'].strip() if data['phone'] else ''
            if phone:
                phone = re.sub(r'\D', '', phone)
                if len(phone) != 10:
                    return jsonify({
                        'success': False,
                        'message': 'Phone must be 10 digits'
                    }), 400
            user.phone = phone if phone else None

        if 'password' in data and data['password']:
            if len(data['password']) < 8:
                return jsonify({
                    'success': False,
                    'message': 'Password must be at least 8 characters'
                }), 400
            user.set_password(data['password'])

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'user': {
                'name': user.name,
                'email': user.email,
                'phone': user.phone or ''
            }
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error updating profile: {str(e)}')
        return jsonify({'success': False, 'message': str(e)}), 500