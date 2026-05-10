# helpers/html_helpers.py
import re
import html
from docx.enum.text import WD_ALIGN_PARAGRAPH


def process_paragraph_html(paragraph, replacements):
    """Process a paragraph and return HTML"""
    try:
        full_text = paragraph.text

        if not full_text.strip():
            return None

        result_text = full_text
        sorted_replacements = sorted(replacements.items(), key=lambda x: len(x[0]), reverse=True)

        for key, value in sorted_replacements:
            if key in result_text:
                if value and value.strip():
                    result_text = result_text.replace(
                        key, f'<strong class="replaced-value-bold">{value}</strong>'
                    )
                else:
                    result_text = result_text.replace(key, '')

        result_text = re.sub(r'\s+', ' ', result_text)
        result_text = re.sub(r'\s+\.', '.', result_text)
        result_text = re.sub(r'\s+,', ',', result_text)
        result_text = result_text.strip()

        if not result_text:
            return None

        styles = []
        align_style = ''

        if paragraph.alignment:
            if paragraph.alignment == WD_ALIGN_PARAGRAPH.CENTER:
                align_style = 'text-align: center;'
            elif paragraph.alignment == WD_ALIGN_PARAGRAPH.RIGHT:
                align_style = 'text-align: right;'
            elif paragraph.alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
                align_style = 'text-align: justify;'

        indent_left = 0
        indent_right = 0
        indent_first_line = 0

        if paragraph.paragraph_format:
            if paragraph.paragraph_format.left_indent:
                indent_left = paragraph.paragraph_format.left_indent.pt
            if paragraph.paragraph_format.right_indent:
                indent_right = paragraph.paragraph_format.right_indent.pt
            if paragraph.paragraph_format.first_line_indent:
                indent_first_line = paragraph.paragraph_format.first_line_indent.pt

        if indent_left > 0:
            styles.append(f'margin-left: {indent_left}pt;')
        if indent_right > 0:
            styles.append(f'margin-right: {indent_right}pt;')
        if indent_first_line > 0:
            styles.append(f'text-indent: {indent_first_line}pt;')

        space_before = 0
        space_after = 0
        line_spacing = 1.5

        if paragraph.paragraph_format:
            if paragraph.paragraph_format.space_before:
                space_before = paragraph.paragraph_format.space_before.pt
            if paragraph.paragraph_format.space_after:
                space_after = paragraph.paragraph_format.space_after.pt
            if paragraph.paragraph_format.line_spacing:
                line_spacing = paragraph.paragraph_format.line_spacing

        if space_before > 0:
            styles.append(f'margin-top: {space_before}pt;')
        if space_after > 0:
            styles.append(f'margin-bottom: {space_after}pt;')

        is_list_item = False
        list_type = None

        if paragraph.style and paragraph.style.name:
            style_name = paragraph.style.name.lower()
            if 'list' in style_name or 'number' in style_name:
                is_list_item = True
                if 'bullet' in style_name:
                    list_type = 'bullet'
                else:
                    list_type = 'number'

        font_styles = []
        if paragraph.runs:
            first_run = paragraph.runs[0]
            if first_run.font and first_run.font.size:
                font_styles.append(f'font-size: {first_run.font.size.pt}pt;')
            if first_run.font and first_run.font.name:
                font_styles.append(
                    f'font-family: "{first_run.font.name}", Calibri, "Times New Roman", serif;'
                )
            if first_run.bold:
                font_styles.append('font-weight: bold;')
            if first_run.underline:
                font_styles.append('text-decoration: underline;')

        style_str = ' '.join(styles + font_styles)

        if is_list_item:
            list_class = 'print-numbered-item' if list_type == 'number' else 'print-list-item'
            return (
                f'<div class="{list_class}" '
                f'style="{align_style} {style_str} margin-bottom: 6px;">'
                f'{result_text}</div>'
            )
        else:
            return (
                f'<p style="{align_style} {style_str} '
                f'margin-bottom: 12px; line-height: {line_spacing};">'
                f'{result_text}</p>'
            )

    except Exception as e:
        return None


def process_table_html(table, replacements):
    """Process table and return HTML"""
    try:
        html_rows = []

        for row in table.rows:
            html_cells = []
            for cell in row.cells:
                cell_text = cell.text

                if not cell_text.strip():
                    html_cells.append('<td>&nbsp;</td>')
                    continue

                modified_text = cell_text
                for key, value in replacements.items():
                    if key in modified_text:
                        if value and value.strip():
                            modified_text = modified_text.replace(
                                key, f'<span class="replaced-value">{value}</span>'
                            )
                        else:
                            modified_text = modified_text.replace(key, '')

                modified_text = re.sub(r'\s+', ' ', modified_text).strip()

                cell_html = []
                for paragraph in cell.paragraphs:
                    if paragraph.runs:
                        for run in paragraph.runs:
                            run_text = run.text
                            if not run_text:
                                continue

                            for key, value in replacements.items():
                                if key in run_text:
                                    if value and value.strip():
                                        run_text = run_text.replace(
                                            key,
                                            f'<span class="replaced-value">{value}</span>'
                                        )
                                    else:
                                        run_text = run_text.replace(key, '')

                            run_styles = []
                            if run.bold:
                                run_styles.append('font-weight: bold;')
                            if run.italic:
                                run_styles.append('font-style: italic;')
                            if run.underline:
                                run_styles.append('text-decoration: underline;')
                            if run.font and run.font.size:
                                run_styles.append(f'font-size: {run.font.size.pt}pt;')

                            if run_styles:
                                cell_html.append(
                                    f'<span style="{" ".join(run_styles)}">{run_text}</span>'
                                )
                            else:
                                cell_html.append(run_text)

                final_html = ''.join(cell_html) if cell_html else modified_text
                html_cells.append(f'<td>{final_html}</td>')

            html_rows.append(f'<tr>{"".join(html_cells)}</tr>')

        if html_rows:
            return (
                f'<table class="print-table" '
                f'style="width: 100%; border-collapse: collapse; margin: 20px 0;">'
                f'{"".join(html_rows)}</table>'
            )

        return None

    except Exception as e:
        return None


def generate_print_html_page(documents_html, document_name):
    """Generate complete HTML page for printing"""
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
        <title>Print Preview - {html.escape(document_name or 'Document')}</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                background: #e2e8f0;
                padding: 20px;
                font-family: 'Calibri', 'Times New Roman', Times, serif;
            }}
            .print-container {{ max-width: 1100px; margin: 0 auto; }}
            .print-controls {{
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }}
            .print-btn {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                transition: all 0.3s ease;
                font-family: system-ui, -apple-system, sans-serif;
            }}
            .print-btn:hover {{
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
            }}
            .print-document-wrapper {{
                background: white;
                border-radius: 12px;
                margin-bottom: 30px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                overflow: hidden;
            }}
            .print-document-header {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 24px;
                font-weight: 600;
            }}
            .print-document-body {{ padding: 40px; background: white; }}
            p {{ margin-bottom: 12px; line-height: 1.6; }}
            .print-list-item, .print-numbered-item {{
                margin-bottom: 6px;
                line-height: 1.6;
                position: relative;
            }}
            .replaced-value-bold {{
                font-weight: bold !important;
                background-color: #d4edda;
                padding: 2px 4px;
                border-radius: 4px;
            }}
            .print-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            .print-table td, .print-table th {{
                border: 1px solid #000;
                padding: 10px;
                vertical-align: top;
            }}
            @media (max-width: 768px) {{
                body {{ padding: 10px; }}
                .print-document-body {{ padding: 20px; }}
                .print-controls {{ bottom: 10px; right: 10px; }}
                .print-btn {{ padding: 8px 16px; font-size: 12px; }}
            }}
            @media print {{
                body {{ background: white; padding: 0; margin: 0; }}
                .print-controls {{ display: none; }}
                .print-document-wrapper {{
                    box-shadow: none;
                    margin: 0;
                    page-break-after: always;
                    border-radius: 0;
                }}
                .print-document-wrapper:last-child {{ page-break-after: auto; }}
                .print-document-body {{ padding: 1.5cm; }}
                .replaced-value-bold {{
                    background: none !important;
                    padding: 0 !important;
                    font-weight: bold !important;
                }}
            }}
        </style>
    </head>
    <body>
        <div class="print-container">
            <div class="print-controls">
                <button class="print-btn" onclick="window.print()">
                    🖨️ Print / Save as PDF
                </button>
            </div>
            {''.join(documents_html)}
        </div>
        <script>window.scrollTo(0, 0);</script>
    </body>
    </html>
    """