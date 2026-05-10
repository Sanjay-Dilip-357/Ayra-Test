# routes/dashboard.py
import logging
from flask import Blueprint, session, render_template, redirect, url_for
from models import db, User, Draft
from routes.auth import login_required

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/dashboard')
@login_required
def dashboard():
    """User dashboard"""
    user_role = session.get('user_role')

    if user_role == 'super_admin':
        return redirect(url_for('super_admin.super_admin_dashboard'))
    if user_role == 'admin':
        return redirect(url_for('admin.admin_dashboard'))

    user_id = session.get('user_id')
    user = db.session.get(User, user_id)

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

    return render_template(
        'dashboard.html',
        user=user,
        user_name=user.name,
        stats=stats
    )