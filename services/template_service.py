# services/template_service.py
import logging
from pathlib import Path
from helpers.docx_helpers import get_templates

logger = logging.getLogger(__name__)


def get_all_template_info(template_config):
    """Get info for all templates"""
    template_info = {}
    for key, config in template_config.items():
        folder = config['folder']
        templates = get_templates(folder)
        template_info[key] = {
            'name': config['name'],
            'description': config['description'],
            'folder': folder,
            'icon': config['icon'],
            'color': config['color'],
            'count': len(templates),
            'files': templates
        }
    return template_info


def resolve_template_folder(template_type, template_config, preview_data, replacements):
    """
    Resolve which template folder to use based on
    template type, folder type and replacements.
    """
    template_folder_str = preview_data.get('template_folder')

    if not template_folder_str:
        config = template_config.get(template_type, {})
        folder_type = preview_data.get('folder_type', 'main')
        relation = replacements.get('UPDATE_RELATION', '')

        if folder_type == 'unmarried' or (
            relation == 'D/o' and not replacements.get('SPOUSE_NAME1')
        ):
            if 'unmarried_subfolder' in config:
                template_folder_str = config['unmarried_subfolder']
            else:
                template_folder_str = config.get('folder', '')
        else:
            template_folder_str = config.get('folder', '')

    return template_folder_str


def get_folder_by_relation(template_type, template_config, relation_input, spouse_name=''):
    """
    Get folder path based on relation input.
    Returns (folder_path, folder_type)
    """
    config = template_config.get(template_type, {})

    if template_type in ['major_template', 'religion_template']:
        if relation_input.lower() == 'd':
            if not spouse_name and 'unmarried_subfolder' in config:
                return config['unmarried_subfolder'], 'unmarried'

    return config.get('folder', ''), 'main'