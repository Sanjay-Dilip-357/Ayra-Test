# routes/__init__.py
from .auth import auth_bp, login_required, admin_required, super_admin_required
from .setup import setup_bp
from .super_admin import super_admin_bp
from .admin import admin_bp
from .dashboard import dashboard_bp
from .drafts import drafts_bp
from .documents import documents_bp
from .phone import phone_bp
from .main import main_bp