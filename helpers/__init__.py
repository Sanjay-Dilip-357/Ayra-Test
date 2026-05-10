# helpers/__init__.py
from .text_helpers import (
    to_uppercase,
    to_uppercase_preserve_alias,
    format_date_to_ddmmyyyy,
    generate_email_from_name,
    create_safe_folder_name,
    resolve_he_she,
    get_gender_pronouns,
    GENDER_PRONOUNS,
    GENDER_PRONOUNS_BY_GENDER
)

from .docx_helpers import (
    apply_format,
    replace_text_in_paragraph,
    replace_text_in_tables,
    get_templates,
    get_all_template_info
)

from .html_helpers import (
    process_paragraph_html,
    process_table_html,
    generate_print_html_page
)