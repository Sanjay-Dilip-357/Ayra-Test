# routes/main.py
import logging
from flask import Blueprint, render_template, redirect, url_for, session

logger = logging.getLogger(__name__)

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
@main_bp.route('/home')
def index():
    """Landing page"""
    return render_template('index.html')