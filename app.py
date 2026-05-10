# app.py
import os
import platform
import subprocess
from pathlib import Path
from flask import Flask
from models import db, init_db
from config import (
    TEMPLATE_CONFIG,
    SQLALCHEMY_DATABASE_URI
)

# ── Create Flask app ─────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'ayra_services_secret_key_2026')

# ── Database configuration ───────────────────────────────────────────────────
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 10,
    'max_overflow': 20
}

# ── Initialize database ──────────────────────────────────────────────────────
init_db(app)

# ── Create template folders if not exist ────────────────────────────────────
for template_key, template_info in TEMPLATE_CONFIG.items():
    Path(template_info['folder']).mkdir(parents=True, exist_ok=True)
    if 'unmarried_subfolder' in template_info:
        Path(template_info['unmarried_subfolder']).mkdir(parents=True, exist_ok=True)


# ── Font setup ───────────────────────────────────────────────────────────────
def setup_fonts_on_startup():
    """Install bundled fonts at app startup"""
    import shutil

    fonts_src = Path(__file__).parent / 'fonts'

    if not fonts_src.exists():
        print('⚠️ No fonts/ folder found - skipping font setup')
        return

    system = platform.system()

    if system == 'Linux':
        fonts_dest = Path('/usr/local/share/fonts/custom/')
        fonts_dest.mkdir(parents=True, exist_ok=True)

        count = 0
        for font_file in fonts_src.iterdir():
            if font_file.suffix.lower() in ['.ttf', '.otf', '.ttc']:
                shutil.copy2(font_file, fonts_dest / font_file.name)
                print(f'  Copied font: {font_file.name}')
                count += 1

        if count > 0:
            try:
                subprocess.run(
                    ['fc-cache', '-fv'],
                    capture_output=True,
                    timeout=60
                )
                print(f'✅ Font cache rebuilt - {count} fonts installed')
            except Exception as e:
                print(f'⚠️ Font cache warning: {e}')

    elif system == 'Windows':
        print('✅ Windows detected - system fonts already available')

    elif system == 'Darwin':
        fonts_dest = Path.home() / 'Library' / 'Fonts'
        fonts_dest.mkdir(parents=True, exist_ok=True)
        count = 0
        for font_file in fonts_src.iterdir():
            if font_file.suffix.lower() in ['.ttf', '.otf', '.ttc']:
                shutil.copy2(font_file, fonts_dest / font_file.name)
                count += 1
        print(f'✅ macOS - {count} fonts installed')


setup_fonts_on_startup()


# ── Register Blueprints ──────────────────────────────────────────────────────
from routes import (
    auth_bp,
    setup_bp,
    super_admin_bp,
    admin_bp,
    dashboard_bp,
    drafts_bp,
    documents_bp,
    phone_bp,
    main_bp
)

app.register_blueprint(main_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(setup_bp)
app.register_blueprint(super_admin_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(drafts_bp)
app.register_blueprint(documents_bp)
app.register_blueprint(phone_bp)


# ── Initialize database tables ───────────────────────────────────────────────
with app.app_context():
    db.create_all()


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    app.run(
        debug=True,
        use_reloader=False
    )