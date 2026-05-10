# services/__init__.py
from .phone_service import (
    load_phone_numbers_from_csv,
    get_available_phones,
    get_random_phone,
    mark_phones_as_used,
    get_phone_stats,
    reset_phone_tracking
)

from .template_service import (
    get_all_template_info,
    resolve_template_folder,
    get_folder_by_relation
)

from .document_service import (
    prepare_replacements,
    generate_documents_to_memory,
    get_cd_document_content
)

from .pdf_service import (
    get_ram_disk_path,
    find_libreoffice_executable,
    convert_all_docx_to_pdfs_batch,
    merge_pdfs_bytes,
    # ── NEW: Print job tracker ──
    create_print_job,
    set_print_process,
    is_job_cancelled,
    cleanup_print_job,
    cancel_print_job,
    print_jobs,
    print_jobs_lock
)