# routes/setup.py
import logging
from datetime import datetime, timezone
from flask import Blueprint, request, session, render_template, redirect, url_for
from models import db, User
from config import DEFAULT_ADMIN_PASSWORD
from routes.auth import super_admin_required

logger = logging.getLogger(__name__)

setup_bp = Blueprint('setup', __name__)


@setup_bp.route('/setup-super-admin', methods=['GET', 'POST'])
def setup_super_admin():
    """One-time super admin setup"""
    from flask import abort
    if User.super_admin_exists():
        abort(403)

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        phone = request.form.get('phone', '').strip()
        password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        errors = []

        if not name:
            errors.append('Name is required')
        if not email:
            errors.append('Email is required')
        if not password:
            errors.append('Password is required')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters')
        if password != confirm_password:
            errors.append('Passwords do not match')
        if User.get_by_email(email):
            errors.append('Email already exists')

        if errors:
            return render_template(
                'setup_super_admin.html',
                errors=errors, name=name, email=email, phone=phone
            )

        try:
            super_admin = User(
                name=name, email=email, phone=phone,
                role='super_admin', is_active=True
            )
            super_admin.set_password(password)
            db.session.add(super_admin)
            db.session.commit()

            return render_template(
                'setup_success.html',
                title='Super Admin Created!',
                name=name, email=email,
                role='Super Administrator',
                redirect_url='/'
            )

        except Exception as e:
            db.session.rollback()
            return render_template(
                'setup_super_admin.html',
                errors=[str(e)], name=name, email=email, phone=phone
            )

    return render_template('setup_super_admin.html')


@setup_bp.route('/create-super-admin', methods=['GET', 'POST'])
@super_admin_required
def create_super_admin():
    """Create additional super admins (only by super admin)"""
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        phone = request.form.get('phone', '').strip()
        password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        errors = []

        if not name:
            errors.append('Name is required')
        if not email:
            errors.append('Email is required')
        if not password:
            errors.append('Password is required')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters')
        if password != confirm_password:
            errors.append('Passwords do not match')
        if User.get_by_email(email):
            errors.append('Email already exists')

        if errors:
            return render_template('setup_super_admin.html', errors=errors)

        try:
            new_super_admin = User(
                name=name, email=email, phone=phone,
                role='super_admin', is_active=True,
                created_by=session.get('user_id')
            )
            new_super_admin.set_password(password)
            db.session.add(new_super_admin)
            db.session.commit()

            return render_template(
                'setup_success.html',
                title='Super Admin Created!',
                name=name, email=email,
                role='Super Administrator',
                redirect_url='/superadmin/dashboard'
            )

        except Exception as e:
            db.session.rollback()
            return render_template(
                'setup_super_admin.html', errors=[str(e)]
            )

    return render_template('setup_super_admin.html')


@setup_bp.route('/setup-admin', methods=['GET', 'POST'])
def setup_admin():
    """Admin setup"""
    is_super_admin = session.get('user_role') == 'super_admin'

    if not is_super_admin and User.admin_exists():
        return render_template(
            'setup_complete.html',
            message='Admin setup requires Super Admin access',
            redirect_url='/'
        )

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        phone = request.form.get('phone', '').strip()
        password = request.form.get('password', '').strip()
        confirm_password = request.form.get('confirm_password', '').strip()

        errors = []

        if not name:
            errors.append('Name is required')
        if not email:
            errors.append('Email is required')
        if not password:
            errors.append('Password is required')
        if len(password) < 8:
            errors.append('Password must be at least 8 characters')
        if password != confirm_password:
            errors.append('Passwords do not match')
        if User.get_by_email(email):
            errors.append('Email already exists')

        if errors:
            return render_template(
                'setup_admin.html',
                errors=errors, name=name, email=email, phone=phone,
                is_super_admin=is_super_admin
            )

        try:
            admin = User(
                name=name, email=email, phone=phone,
                role='admin', is_active=True,
                created_by=session.get('user_id') if is_super_admin else None
            )
            admin.set_password(password)
            db.session.add(admin)
            db.session.commit()

            redirect_url = (
                '/superadmin/dashboard' if is_super_admin else '/'
            )

            return render_template(
                'setup_success.html',
                title='Admin Created!',
                name=name, email=email,
                role='Administrator',
                redirect_url=redirect_url
            )

        except Exception as e:
            db.session.rollback()
            return render_template(
                'setup_admin.html',
                errors=[f'Error: {str(e)}'],
                name=name, email=email, phone=phone,
                is_super_admin=is_super_admin
            )

    return render_template('setup_admin.html', is_super_admin=is_super_admin)