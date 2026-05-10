# helpers/docx_helpers.py
import re
from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor


def apply_format(run, formatting):
    if formatting is None:
        return

    if formatting.get('bold') is not None:
        run.bold = formatting['bold']
    if formatting.get('italic') is not None:
        run.italic = formatting['italic']
    if formatting.get('underline') is not None:
        run.underline = formatting['underline']
    if formatting.get('font_name'):
        run.font.name = formatting['font_name']
    if formatting.get('font_size'):
        run.font.size = formatting['font_size']
    if formatting.get('font_color'):
        run.font.color.rgb = formatting['font_color']
    if formatting.get('superscript') is not None:
        run.font.superscript = formatting['superscript']


def replace_text_in_paragraph(paragraph, replacements):
    """Replace text in paragraph preserving formatting"""
    full_text = paragraph.text

    needs_replacement = any(old_text in full_text for old_text in replacements.keys())
    if not needs_replacement or not paragraph.runs:
        return

    char_formats = []
    for run in paragraph.runs:
        run_format = {
            'bold': run.bold,
            'italic': run.italic,
            'underline': run.underline,
            'font_name': run.font.name,
            'font_size': run.font.size,
            'font_color': run.font.color.rgb if run.font.color and run.font.color.rgb else None,
            'superscript': run.font.superscript
        }
        for char in run.text:
            char_formats.append(run_format.copy())

    combined_text = ''.join(run.text for run in paragraph.runs)
    new_text = combined_text
    new_char_formats = char_formats.copy()

    sorted_replacements = sorted(replacements.items(), key=lambda x: len(x[0]), reverse=True)

    for old_text, new_text_value in sorted_replacements:
        if new_text_value is None:
            new_text_value = ''

        new_text_value = str(new_text_value)

        while old_text in new_text:
            pos = new_text.find(old_text)
            if pos == -1:
                break

            if pos < len(new_char_formats):
                placeholder_format = new_char_formats[pos].copy()
            else:
                placeholder_format = char_formats[0].copy() if char_formats else {}

            new_text = new_text[:pos] + new_text_value + new_text[pos + len(old_text):]
            del new_char_formats[pos:pos + len(old_text)]

            for i in range(len(new_text_value)):
                format_copy = placeholder_format.copy()

                if old_text == "ALPHA_DATE":
                    match = re.match(r'(\d{1,2})(ST|ND|RD|TH)', new_text_value, re.IGNORECASE)
                    if match:
                        day_len = len(match.group(1))
                        suffix_len = len(match.group(2))
                        if i >= day_len and i < day_len + suffix_len:
                            format_copy['superscript'] = True

                new_char_formats.insert(pos + i, format_copy)

    while '  ' in new_text:
        double_space_pos = new_text.find('  ')
        new_text = new_text[:double_space_pos] + ' ' + new_text[double_space_pos + 2:]
        if double_space_pos < len(new_char_formats):
            del new_char_formats[double_space_pos]

    while ' ,' in new_text:
        pos = new_text.find(' ,')
        new_text = new_text[:pos] + ',' + new_text[pos + 2:]
        if pos < len(new_char_formats):
            del new_char_formats[pos]

    while ' .' in new_text:
        pos = new_text.find(' .')
        new_text = new_text[:pos] + '.' + new_text[pos + 2:]
        if pos < len(new_char_formats):
            del new_char_formats[pos]

    leading_spaces = len(new_text) - len(new_text.lstrip())
    trailing_spaces = len(new_text) - len(new_text.rstrip())

    if leading_spaces > 0:
        new_text = new_text[leading_spaces:]
        new_char_formats = new_char_formats[leading_spaces:]

    if trailing_spaces > 0 and len(new_text) > 0:
        new_text = new_text[:-trailing_spaces] if trailing_spaces > 0 else new_text
        new_char_formats = new_char_formats[:-trailing_spaces] if trailing_spaces > 0 else new_char_formats

    for run in paragraph.runs:
        run.text = ''

    if not new_char_formats or not new_text:
        if new_text:
            paragraph.runs[0].text = new_text
        return

    def format_key(fmt):
        if fmt is None:
            return None
        return (fmt.get('bold'), fmt.get('italic'), fmt.get('underline'),
                fmt.get('font_name'), fmt.get('font_size'), str(fmt.get('font_color')),
                fmt.get('superscript'))

    groups = []
    current_group = {'text': '', 'format': new_char_formats[0] if new_char_formats else None}

    for i, char in enumerate(new_text):
        char_format = new_char_formats[i] if i < len(new_char_formats) else (
            new_char_formats[-1] if new_char_formats else None)

        if format_key(char_format) == format_key(current_group['format']):
            current_group['text'] += char
        else:
            if current_group['text']:
                groups.append(current_group)
            current_group = {'text': char, 'format': char_format}

    if current_group['text']:
        groups.append(current_group)

    if groups:
        paragraph.runs[0].text = groups[0]['text']
        apply_format(paragraph.runs[0], groups[0]['format'])

        for group in groups[1:]:
            new_run = paragraph.add_run(group['text'])
            apply_format(new_run, group['format'])


def replace_text_in_tables(tables, replacements):
    for table in tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    replace_text_in_paragraph(paragraph, replacements)


def get_templates(folder):
    templates = []
    folder_path = Path(folder)
    if folder_path.exists():
        for file in folder_path.iterdir():
            if file.is_file() and file.suffix.lower() == '.docx' and not file.name.startswith('~$'):
                templates.append(file.name)
    return sorted(templates)


def get_all_template_info(template_config):
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