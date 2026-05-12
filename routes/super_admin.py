# routes/super_admin.py
import time
import logging
from models import db, User, Draft
from sqlalchemy import text, inspect
from datetime import datetime, timezone
from routes.auth import super_admin_required
from config import DEFAULT_ADMIN_PASSWORD, DEFAULT_USER_PASSWORD
from flask import Blueprint, request, jsonify, session, render_template

logger = logging.getLogger(__name__)

# Single blueprint for everything super_admin related
super_admin_bp = Blueprint('super_admin', __name__)

# ==================== DB CONSOLE SECURITY ====================
FORBIDDEN_READ = {'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'UPDATE', 'INSERT', 'CREATE'}

# ==================== DB CONSOLE ROUTES ====================

@super_admin_bp.route('/api/super-admin/db/meta', methods=['GET'])
@super_admin_required
def db_meta():
    """Return DB engine name and row counts for all tables"""
    try:
        insp = inspect(db.engine)
        tables = []
        for t in insp.get_table_names():
            try:
                count = db.session.execute(
                    text(f'SELECT COUNT(*) FROM "{t}"')
                ).scalar()
            except Exception:
                count = 0
            tables.append({'name': t, 'rows': count})
        return jsonify({
            'ok': True,
            'engine': db.engine.dialect.name,
            'tables': tables
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500


@super_admin_bp.route('/api/super-admin/db/query', methods=['POST'])
@super_admin_required
def db_query():
    """Execute a raw SQL query — read or write mode"""
    body  = request.get_json() or {}
    sql   = (body.get('sql') or '').strip().rstrip(';')
    mode  = body.get('mode', 'read')   # 'read' | 'write'
    limit = int(body.get('limit') or 0)

    if not sql:
        return jsonify({'ok': False, 'error': 'Empty query'}), 400

    first_word = sql.split(None, 1)[0].upper()

    if mode == 'read':
        sql_upper = sql.upper()
        for forbidden in FORBIDDEN_READ:
            # Check as whole word to avoid false positives
            import re
            if re.search(rf'\b{forbidden}\b', sql_upper):
                return jsonify({
                    'ok': False,
                    'error': f'"{forbidden}" is not allowed in READ mode. '
                             f'Switch to WRITE mode.'
                }), 400


    # Auto-append LIMIT for SELECT queries in read mode
    if (mode == 'read'
            and first_word == 'SELECT'
            and limit > 0
            and 'LIMIT' not in sql.upper()):
        sql = f'{sql} LIMIT {limit}'

    t0 = time.perf_counter()
    try:
        result      = db.session.execute(text(sql))
        elapsed_ms  = round((time.perf_counter() - t0) * 1000, 2)

        if result.returns_rows:
            cols = list(result.keys())
            rows = [list(r) for r in result.fetchall()]

            # Make every value JSON-safe
            safe_rows = []
            for row in rows:
                safe_row = []
                for v in row:
                    if hasattr(v, 'isoformat'):   # datetime / date
                        safe_row.append(v.isoformat())
                    elif hasattr(v, '__float__'):  # Decimal
                        safe_row.append(float(v))
                    else:
                        safe_row.append(v)
                safe_rows.append(safe_row)

            return jsonify({
                'ok':         True,
                'kind':       'rows',
                'columns':    cols,
                'rows':       safe_rows,
                'row_count':  len(safe_rows),
                'elapsed_ms': elapsed_ms
            })

        # Non-SELECT (write mode)
        if mode == 'write':
            db.session.commit()

        return jsonify({
            'ok':         True,
            'kind':       'status',
            'message':    f'OK — {result.rowcount} row(s) affected',
            'row_count':  result.rowcount,
            'elapsed_ms': elapsed_ms
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok':         False,
            'error':      str(e),
            'elapsed_ms': round((time.perf_counter() - t0) * 1000, 2)
        }), 400


# ==================== DASHBOARD ====================

@super_admin_bp.route('/superadmin/dashboard')
@super_admin_required
def super_admin_dashboard():
    """Super Admin dashboard page"""
    user_id     = session.get('user_id')
    super_admin = db.session.get(User, user_id)
    return render_template(
        'super_admin_dashboard.html',
        admin=super_admin,
        admin_name=super_admin.name
    )


# ==================== STATS ====================

@super_admin_bp.route('/api/superadmin/stats')
@super_admin_required
def api_super_admin_stats():
    """Get super admin dashboard statistics"""
    try:
        super_admin_count = User.query.filter_by(role='super_admin').count()
        admin_count       = User.query.filter_by(role='admin').count()
        user_count        = User.query.filter_by(role='user').count()
        active_admins     = User.query.filter_by(role='admin',  is_active=True).count()
        active_users      = User.query.filter_by(role='user',   is_active=True).count()
        total_docs        = Draft.query.count()
        draft_count       = Draft.query.filter_by(status='draft').count()
        pending_count     = Draft.query.filter_by(status='pending').count()
        approved_count    = Draft.query.filter_by(status='approved').count()
        generated_count   = Draft.query.filter_by(status='generated').count()

        admins      = User.query.filter_by(role='admin').all()
        admin_stats = [{
            'id':         a.id,
            'name':       a.name,
            'email':      a.email,
            'phone':      a.phone,
            'is_active':  a.is_active,
            'last_login': a.last_login.isoformat() if a.last_login else None,
            'created_at': a.created_at.isoformat() if a.created_at else None,
        } for a in admins]

        users      = User.query.filter_by(role='user').all()
        user_stats = [{
            'id':         u.id,
            'name':       u.name,
            'email':      u.email,
            'phone':      u.phone,
            'is_active':  u.is_active,
            'last_login': u.last_login.isoformat() if u.last_login else None,
            'created_at': u.created_at.isoformat() if u.created_at else None,
            'stats': {
                'drafts':    Draft.query.filter_by(user_id=u.id, status='draft').count(),
                'pending':   Draft.query.filter_by(user_id=u.id, status='pending').count(),
                'approved':  Draft.query.filter_by(user_id=u.id, status='approved').count(),
                'generated': Draft.query.filter_by(user_id=u.id, status='generated').count(),
                'total':     Draft.query.filter_by(user_id=u.id).count(),
            }
        } for u in users]

        return jsonify({
            'success': True,
            'overall': {
                'super_admins':     super_admin_count,
                'total_admins':     admin_count,
                'active_admins':    active_admins,
                'total_users':      user_count,
                'active_users':     active_users,
                'total_documents':  total_docs,
                'drafts':           draft_count,
                'pending':          pending_count,
                'approved':         approved_count,
                'generated':        generated_count,
            },
            'admins': admin_stats,
            'users':  user_stats,
        })

    except Exception as e:
        logger.exception('Stats error')
        return jsonify({'success': False, 'message': str(e)})


# ==================== ADMINS ====================

@super_admin_bp.route('/api/superadmin/admins', methods=['GET'])
@super_admin_required
def api_get_admins():
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
    try:
        name     = request.json.get('name', '').strip()
        email    = request.json.get('email', '').strip().lower()
        phone    = request.json.get('phone', '').strip()
        password = request.json.get('password', DEFAULT_ADMIN_PASSWORD)

        if not name or not email:
            return jsonify({'success': False, 'message': 'Name and email are required'})
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
        return jsonify({'success': True, 'message': 'Admin created successfully',
                        'admin': admin.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins/<admin_id>', methods=['PUT'])
@super_admin_required
def api_update_admin(admin_id):
    try:
        admin = db.session.get(User, admin_id)
        if not admin or admin.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin not found'})

        name         = request.json.get('name', '').strip()
        phone        = request.json.get('phone', '').strip()
        new_email    = request.json.get('email', '').strip().lower()
        new_password = request.json.get('password', '').strip()

        if name:      admin.name  = name
        if phone is not None: admin.phone = phone

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
    try:
        admin = db.session.get(User, admin_id)
        if not admin or admin.role != 'admin':
            return jsonify({'success': False, 'message': 'Admin not found'})

        admin.is_active = not admin.is_active
        db.session.commit()
        status = 'activated' if admin.is_active else 'deactivated'
        return jsonify({'success': True, 'message': f'Admin {status} successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/admins/<admin_id>', methods=['DELETE'])
@super_admin_required
def api_delete_admin(admin_id):
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


# ==================== USERS ====================

@super_admin_bp.route('/api/superadmin/users', methods=['GET'])
@super_admin_required
def api_super_admin_get_users():
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
    try:
        name     = request.json.get('name', '').strip()
        email    = request.json.get('email', '').strip().lower()
        phone    = request.json.get('phone', '').strip()
        password = request.json.get('password', DEFAULT_USER_PASSWORD)

        if not name or not email:
            return jsonify({'success': False, 'message': 'Name and email are required'})
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
        return jsonify({'success': True, 'message': 'User created successfully',
                        'user': user.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users/<user_id>', methods=['PUT'])
@super_admin_required
def api_super_admin_update_user(user_id):
    try:
        user = db.session.get(User, user_id)
        if not user or user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': 'User not found'})

        name         = request.json.get('name', '').strip()
        phone        = request.json.get('phone', '').strip()
        new_email    = request.json.get('email', '').strip().lower()
        new_password = request.json.get('password', '').strip()

        if name:      user.name  = name
        if phone is not None: user.phone = phone

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
    try:
        user = db.session.get(User, user_id)
        if not user or user.role not in ['user', 'admin']:
            return jsonify({'success': False, 'message': 'User not found'})

        user.is_active = not user.is_active
        db.session.commit()
        status = 'activated' if user.is_active else 'deactivated'
        return jsonify({'success': True, 'message': f'User {status} successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)})


@super_admin_bp.route('/api/superadmin/users/<user_id>', methods=['DELETE'])
@super_admin_required
def api_super_admin_delete_user(user_id):
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


# ==================== DOCUMENTS ====================

@super_admin_bp.route('/api/superadmin/documents')
@super_admin_required
def api_super_admin_get_documents():
    try:
        status = request.args.get('status')
        q = Draft.query.order_by(Draft.modified_at.desc())
        if status:
            q = q.filter_by(status=status)
        drafts = q.all()
        return jsonify({'success': True, 'documents': [d.to_dict() for d in drafts]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
