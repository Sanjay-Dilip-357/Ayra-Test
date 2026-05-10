# AYRA Services - Project Structure Guide

## Overview
This document explains the modular architecture of the AYRA Services application.
The original single `app.py` (4000+ lines) has been split into clean, focused modules.

---

## Quick Reference

| If you want to... | Open this file |
|---|---|
| Change login/register logic | `routes/auth.py` |
| Change admin dashboard | `routes/admin.py` |
| Change super admin features | `routes/super_admin.py` |
| Change user dashboard | `routes/dashboard.py` |
| Change draft save/update/delete | `routes/drafts.py` |
| Change document generation | `routes/documents.py` |
| Change phone number logic | `routes/phone.py` |
| Change landing page route | `routes/main.py` |
| Change setup/first-time admin | `routes/setup.py` |
| Change PDF conversion logic | `services/pdf_service.py` |
| Change DOCX generation logic | `services/document_service.py` |
| Change phone tracking logic | `services/phone_service.py` |
| Change template folder logic | `services/template_service.py` |
| Change text formatting utils | `helpers/text_helpers.py` |
| Change DOCX replace logic | `helpers/docx_helpers.py` |
| Change print/HTML generation | `helpers/html_helpers.py` |
| Change database models | `models.py` |
| Change app settings/config | `config.py` |
| Change Flask app init | `app.py` |

---

## Complete Folder Structure
Ayra-Services/
│
├── app.py # Flask app init + blueprint registration
├── config.py # App settings, template config, constants
├── models.py # Database models (User, Draft, PhoneTracking)
├── otp_service.py # OTP generation and verification
├── phone_numbers.csv # Source of phone numbers for tracking
│
├── fonts/ # Custom fonts for LibreOffice PDF generation
│ └── *.ttf / *.otf
│
├── templates/ # HTML Jinja2 templates (Flask views)
│ ├── index.html
│ ├── dashboard.html
│ ├── admin_dashboard.html
│ ├── super_admin_dashboard.html
│ ├── namechangeservice.html
│ ├── setup_admin.html
│ ├── setup_super_admin.html
│ └── setup_success.html
│
├── static/ # CSS, JS, images
│
├── helpers/ # Pure utility functions (no Flask, no DB)
│ ├── init.py # Exports all helpers
│ ├── text_helpers.py # Text formatting utilities
│ ├── docx_helpers.py # DOCX read/write/replace utilities
│ └── html_helpers.py # HTML generation for print/preview
│
├── services/ # Business logic (no Flask routes)
│ ├── init.py # Exports all services
│ ├── phone_service.py # Phone number tracking and management
│ ├── template_service.py # Template folder resolution
│ ├── document_service.py # Document generation and CD preview
│ └── pdf_service.py # LibreOffice PDF conversion
│
└── routes/ # Flask Blueprints (all route handlers)
├── init.py # Exports all blueprints + decorators
├── auth.py # Login, logout, register, profile
├── setup.py # First-time setup routes
├── main.py # Landing page (index/home)
├── dashboard.py # User dashboard
├── super_admin.py # Super admin dashboard + API
├── admin.py # Admin dashboard + document management
├── drafts.py # Draft CRUD + CD preview for users
├── documents.py # Document generation + preview
└── phone.py # Phone number API

---

## File-by-File Breakdown

---

### `app.py` — Flask App Entry Point
**Size:** ~80 lines (was 4000+)
**Purpose:** Initialize Flask app and register all blueprints

**What it does:**
- Creates the Flask app instance
- Configures database (SQLAlchemy)
- Sets up template folders
- Installs fonts on startup (for LibreOffice on Linux/Render)
- Registers all route blueprints
- Initializes database tables

**Does NOT contain:**
- Any route handlers
- Any business logic
- Any database queries

---

### `config.py` — Configuration
**Purpose:** All app-wide settings and constants

**What it contains:**
- `TEMPLATE_CONFIG` — template types, folders, icons, colors
- `RELATION_MAPPING` — relation input to display mapping
- `CAST_OPTIONS` — list of cast options for forms
- `DEFAULT_USER_PASSWORD` — default password for new users
- `DEFAULT_ADMIN_PASSWORD` — default password for new admins
- `SQLALCHEMY_DATABASE_URI` — database connection string
- `IS_PRODUCTION` — production flag

**When to edit:**
- Adding a new template type
- Changing folder paths
- Changing default passwords
- Changing database URL

---

### `models.py` — Database Models
**Purpose:** SQLAlchemy database table definitions

**What it contains:**
- `User` model — stores all users (super_admin, admin, user)
- `Draft` model — stores all document drafts
- `PhoneTracking` model — tracks used phone numbers
- `init_db()` — initializes database with Flask app

**Key User fields:**
- `role` — super_admin / admin / user
- `is_active` — account enabled/disabled
- `is_approved` — user approved by admin

**Key Draft fields:**
- `status` — draft / pending / approved / generated
- `replacements` — JSON of all placeholder values
- `preview_data` — JSON of template folder info

---

## `helpers/` — Pure Utility Functions

> No Flask, no database. Just Python functions.
> Safe to import anywhere without circular imports.

---

### `helpers/text_helpers.py` — Text Utilities
**Purpose:** String formatting and transformation

| Function | What it does |
|---|---|
| `to_uppercase(value)` | Converts string to uppercase |
| `to_uppercase_preserve_alias(value)` | Uppercases but keeps `alias` lowercase |
| `format_date_to_ddmmyyyy(date_string)` | Converts `YYYY-MM-DD` to `DD/MM/YYYY` |
| `generate_email_from_name(name)` | Auto-generates a Gmail from a name |
| `create_safe_folder_name(name)` | Makes a string safe for folder/file names |
| `resolve_he_she(son_daughter, gender, existing)` | Returns `he` or `she` based on inputs |
| `get_gender_pronouns(son_daughter, gender)` | Returns pronoun dict |

**When to edit:**
- Changing how names are formatted
- Changing date format
- Changing HE_SHE resolution logic

---

### `helpers/docx_helpers.py` — DOCX Utilities
**Purpose:** Reading and modifying Word documents

| Function | What it does |
|---|---|
| `apply_format(run, formatting)` | Applies bold/italic/font to a run |
| `replace_text_in_paragraph(paragraph, replacements)` | Replaces placeholders in a paragraph |
| `replace_text_in_tables(tables, replacements)` | Replaces placeholders in all table cells |
| `get_templates(folder)` | Lists all `.docx` files in a folder |
| `get_all_template_info(template_config)` | Returns info dict for all templates |

**When to edit:**
- Changing how text replacement works
- Changing superscript logic (ST/ND/RD/TH)
- Changing spacing/punctuation cleanup
- Changing how fonts are preserved

---

### `helpers/html_helpers.py` — HTML Generation
**Purpose:** Generating HTML for print preview pages

| Function | What it does |
|---|---|
| `process_paragraph_html(paragraph, replacements)` | Converts a DOCX paragraph to HTML |
| `process_table_html(table, replacements)` | Converts a DOCX table to HTML |
| `generate_print_html_page(documents_html, name)` | Wraps content in full print HTML page |

**When to edit:**
- Changing print preview styling
- Changing how document content appears in browser
- Changing print CSS

---

## `services/` — Business Logic

> Contains core app logic.
> Imports from `helpers/` and `models.py`.
> No Flask route decorators here.

---

### `services/phone_service.py` — Phone Number Management
**Purpose:** Load, track, and manage phone numbers from CSV

| Function | What it does |
|---|---|
| `load_phone_numbers_from_csv()` | Reads all phones from `phone_numbers.csv` |
| `get_available_phones()` | Returns phones not yet marked as used |
| `get_random_phone(exclude_list)` | Picks a random available phone |
| `mark_phones_as_used(phone_numbers)` | Marks phones as permanently used in DB |
| `get_phone_stats()` | Returns total / used / available counts |
| `reset_phone_tracking()` | Resets all phones back to available |

**When to edit:**
- Changing how phones are picked (random vs sequential)
- Changing phone cycle reset logic
- Adding phone validation rules

---

### `services/template_service.py` — Template Resolution
**Purpose:** Decide which template folder to use

| Function | What it does |
|---|---|
| `get_all_template_info(template_config)` | Gets info for all template types |
| `resolve_template_folder(template_type, config, preview_data, replacements)` | Picks correct folder (main vs unmarried) |
| `get_folder_by_relation(template_type, config, relation_input, spouse_name)` | Gets folder based on relation input |

**When to edit:**
- Adding new template folder logic
- Changing when unmarried folder is used
- Adding new template types

---

### `services/document_service.py` — Document Generation
**Purpose:** Fill DOCX templates with data and create ZIP downloads

| Function | What it does |
|---|---|
| `prepare_replacements(replacements)` | Ensures HE_SHE and defaults are set |
| `generate_documents_to_memory(draft, template_config)` | Fills all templates and returns ZIP buffer |
| `get_cd_document_content(template_folder, replacements)` | Returns HTML preview of CD.docx |

**When to edit:**
- Changing how documents are filled
- Changing ZIP structure
- Changing CD preview HTML styling
- Adding new replacement logic

---

### `services/pdf_service.py` — PDF Conversion
**Purpose:** Convert DOCX files to PDF using LibreOffice

| Function | What it does |
|---|---|
| `get_ram_disk_path()` | Gets `/dev/shm` path for fast temp storage |
| `find_libreoffice_executable()` | Finds LibreOffice on Windows/Linux/macOS |
| `convert_all_docx_to_pdfs_batch(docx_files_dict, replacements)` | Converts all DOCX to PDF in one LO call |
| `merge_pdfs_bytes(pdf_bytes_list)` | Merges multiple PDFs into one in memory |

**When to edit:**
- Changing LibreOffice font substitution config
- Changing PDF conversion timeout
- Changing how PDFs are merged
- Fixing LibreOffice path issues

---

## `routes/` — Flask Route Handlers (Blueprints)

> All HTTP endpoints live here.
> Each file is a Flask Blueprint.
> Imports business logic from `services/`.

---

### `routes/auth.py` — Authentication
**Blueprint name:** `auth`
**Purpose:** Login, logout, register, profile management

**Also contains decorators:**
- `@login_required` — redirects to login if not authenticated
- `@admin_required` — redirects if not admin/super_admin
- `@super_admin_required` — redirects if not super_admin

| Route | Method | What it does |
|---|---|---|
| `/login` | GET | Login page redirect |
| `/logout` | GET | Clears session, redirects home |
| `/api/auth/login` | POST | Validates credentials, sets session |
| `/api/auth/register` | POST | Creates new user (pending approval) |
| `/api/auth/logout` | POST | API logout |
| `/api/auth/check` | GET | Check if user is logged in |
| `/api/user/profile` | GET | Get current user profile |
| `/api/user/profile` | PUT | Update current user profile |

---

### `routes/setup.py` — First-Time Setup
**Blueprint name:** `setup`
**Purpose:** One-time setup pages for creating super admin and admin

| Route | Method | What it does |
|---|---|---|
| `/setup-super-admin` | GET/POST | Creates the first super admin |
| `/create-super-admin` | GET/POST | Creates additional super admins |
| `/setup-admin` | GET/POST | Creates admin accounts |

**Note:** `/setup-super-admin` is disabled (403) once a super admin exists.

---

### `routes/main.py` — Landing Page
**Blueprint name:** `main`
**Purpose:** Public-facing pages

| Route | Method | What it does |
|---|---|---|
| `/` | GET | Landing/home page |
| `/home` | GET | Same as `/` |

---

### `routes/dashboard.py` — User Dashboard
**Blueprint name:** `dashboard`
**Purpose:** Regular user dashboard

| Route | Method | What it does |
|---|---|---|
| `/dashboard` | GET | Shows user dashboard with stats |

**Auto-redirects:**
- Super admin → `/superadmin/dashboard`
- Admin → `/admin/dashboard`

---

### `routes/super_admin.py` — Super Admin
**Blueprint name:** `super_admin`
**Purpose:** Super admin dashboard and full system management

| Route | Method | What it does |
|---|---|---|
| `/superadmin/dashboard` | GET | Super admin dashboard page |
| `/api/superadmin/stats` | GET | System-wide statistics |
| `/api/superadmin/admins` | GET | List all admins |
| `/api/superadmin/admins` | POST | Create new admin |
| `/api/superadmin/admins/<id>` | PUT | Update admin |
| `/api/superadmin/admins/<id>/toggle` | POST | Enable/disable admin |
| `/api/superadmin/admins/<id>` | DELETE | Delete admin |
| `/api/superadmin/users` | GET | List all users |
| `/api/superadmin/users` | POST | Create new user |
| `/api/superadmin/users/<id>` | PUT | Update user |
| `/api/superadmin/users/<id>/toggle` | POST | Enable/disable user |
| `/api/superadmin/users/<id>` | DELETE | Delete user |
| `/api/superadmin/documents` | GET | List all documents |

---

### `routes/admin.py` — Admin Management
**Blueprint name:** `admin`
**Purpose:** Admin dashboard, user management, document management

| Route | Method | What it does |
|---|---|---|
| `/admin/dashboard` | GET | Admin dashboard page |
| `/api/admin/stats` | GET | Admin statistics |
| `/api/admin/users` | GET | List all users |
| `/api/admin/users` | POST | Create new user |
| `/api/admin/users/<id>` | PUT | Update user |
| `/api/admin/users/<id>/toggle` | POST | Enable/disable user |
| `/api/admin/users/<id>` | DELETE | Delete user |
| `/api/admin/users/<id>/approve` | POST | Approve pending user |
| `/api/admin/users/<id>/reject` | POST | Revoke user approval |
| `/api/admin/documents` | GET | List all documents |
| `/api/admin/documents/<id>` | PUT | Update document data |
| `/api/admin/documents/<id>` | DELETE | Delete document |
| `/api/admin/documents/<id>/approve` | POST | Approve document |
| `/api/admin/documents/<id>/generate` | POST | Generate + download ZIP |
| `/api/admin/documents/<id>/download` | GET | Download generated ZIP |
| `/api/admin/documents/download-bulk` | POST | Download multiple as ZIP |
| `/api/admin/documents/<id>/toggle-publish` | POST | Publish/unpublish |
| `/api/admin/documents/<id>/print-preview` | GET | JSON print preview |
| `/api/admin/documents/<id>/print-html` | GET | Full HTML print page |
| `/api/admin/documents/<id>/print-pdf` | GET | Merged PDF download |
| `/api/admin/documents/<id>/download-all` | GET | Download all as ZIP |
| `/api/admin/documents/<id>/download-cd` | GET | Download CD.docx only |
| `/api/admin/documents/<id>/cd-preview` | GET | CD document HTML preview |

---

### `routes/drafts.py` — Draft Management (User)
**Blueprint name:** `drafts`
**Purpose:** User-facing draft CRUD and submission

| Route | Method | What it does |
|---|---|---|
| `/api/drafts` | GET | List user's drafts |
| `/api/drafts` | POST | Create new draft |
| `/api/drafts/<id>` | GET | Get specific draft |
| `/api/drafts/<id>` | PUT | Update draft |
| `/api/drafts/<id>` | DELETE | Delete draft |
| `/api/drafts/<id>/approve` | POST | Mark draft as approved |
| `/api/drafts/<id>/submit-approval` | POST | Submit for admin approval |
| `/api/drafts/stats` | GET | Get draft count stats |
| `/api/drafts/save` | POST | Save draft from preview |
| `/api/drafts/<id>/cd-preview` | GET | CD document preview for user |
| `/api/dashboard/stats` | GET | Dashboard statistics |

---

### `routes/documents.py` — Document Generation (User)
**Blueprint name:** `documents`
**Purpose:** Document preview, generation, and download for users

| Route | Method | What it does |
|---|---|---|
| `/namechangeservice` | GET | Name change service form page |
| `/get_template_config/<type>` | GET | Get config for template type |
| `/get_templates_by_relation/<type>/<relation>` | GET | Get templates by relation |
| `/generate_email` | POST | Auto-generate email from name |
| `/preview` | POST | Generate document preview |
| `/update_preview` | POST | Update preview data in session |
| `/generate` | POST | Generate + download ZIP directly |
| `/save_draft` | POST | Save draft from session preview |
| `/api/generate/approved` | GET | List approved drafts |
| `/api/generate/batch` | POST | Generate multiple drafts as ZIP |
| `/api/generate/single/<id>` | POST | Generate single draft |

---

### `routes/phone.py` — Phone Number API
**Blueprint name:** `phone`
**Purpose:** Phone number management API

| Route | Method | What it does |
|---|---|---|
| `/api/phone/next` | POST | Get next random available phone |
| `/api/phone/stats` | GET | Get phone usage statistics |
| `/api/phone/reset` | POST | Reset all phone tracking (admin only) |

---

## Data Flow
User fills form
│
▼
routes/documents.py (preview route)
│
├── helpers/text_helpers.py (format names, dates)
├── helpers/docx_helpers.py (get template list)
└── Saves to session
│
▼
User saves draft
│
▼
routes/drafts.py (save route)
│
├── services/phone_service.py (mark phones as used)
└── models.py → Draft saved to DB
│
▼
Admin approves draft
│
▼
routes/admin.py (approve route)
│
└── models.py → Draft status = approved
│
▼
Admin generates document
│
▼
routes/admin.py (generate route)
│
├── services/document_service.py
│ ├── helpers/docx_helpers.py (replace text)
│ ├── helpers/text_helpers.py (resolve HE_SHE)
│ └── services/template_service.py (resolve folder)
└── Returns ZIP file download

---

## PDF Generation Flow
Admin clicks Print PDF
│
▼
routes/admin.py (print-pdf route)
│
├── services/document_service.py → prepare_replacements()
│
├── services/pdf_service.py → convert_all_docx_to_pdfs_batch()
│ ├── Fill all DOCX templates
│ ├── Call LibreOffice ONCE for all files
│ └── Read all PDFs into memory
│
├── services/pdf_service.py → merge_pdfs_bytes()
│ └── Merge all PDFs into one (Witness × 2)
│
└── Return merged PDF to browser

---

## Authentication Flow
User visits /login
│
▼
routes/auth.py → api_login()
│
├── Validates email + password
├── Checks is_active
├── Checks is_approved (for regular users)
├── Sets session variables
└── Redirects based on role:
├── super_admin → /superadmin/dashboard
├── admin → /admin/dashboard
└── user → /dashboard

---

## Session Variables

| Key | Value | Set by |
|---|---|---|
| `user_id` | User UUID | `auth.api_login` |
| `user_name` | User full name | `auth.api_login` |
| `user_email` | User email | `auth.api_login` |
| `user_role` | super_admin / admin / user | `auth.api_login` |
| `preview_data` | Dict with template + replacements | `documents.preview_document` |

---

## Decorator Reference

All decorators are defined in `routes/auth.py`
and exported via `routes/__init__.py`

```python
# Require any logged-in user
@login_required

# Require admin or super_admin
@admin_required

# Require super_admin only
@super_admin_required
Usage in any route file:

Python

from routes.auth import login_required, admin_required, super_admin_required
Adding a New Feature - Checklist
Adding a new route:
Decide which blueprint it belongs to
Open the correct routes/*.py file
Add the route function
If it needs business logic → add to services/
If it needs a utility function → add to helpers/
Adding a new template type:
Open config.py
Add entry to TEMPLATE_CONFIG
Create the folder
Add templates to the folder
No code changes needed elsewhere
Adding a new database field:
Open models.py
Add the column
Run db.create_all() or use migrations
Environment Variables
Variable	Default	Purpose
SECRET_KEY	ayra_services_secret_key_2026	Flask session encryption
DATABASE_URL	SQLite local	Database connection
IS_PRODUCTION	False	Switches DB to PostgreSQL
Dependencies
Package	Purpose
flask	Web framework
flask-sqlalchemy	Database ORM
python-docx	Read/write Word documents
pypdf	Merge PDF files
LibreOffice	Convert DOCX to PDF (system install)
Common Debug Scenarios
Problem	Where to look
Login not working	routes/auth.py → api_login()
Draft not saving	routes/drafts.py → api_save_draft_from_preview()
Wrong HE/SHE in document	services/document_service.py → prepare_replacements()
PDF not generating	services/pdf_service.py → convert_all_docx_to_pdfs_batch()
Wrong template folder	services/template_service.py → resolve_template_folder()
Phone not being picked	services/phone_service.py → get_random_phone()
Text not replacing in DOCX	helpers/docx_helpers.py → replace_text_in_paragraph()
Print preview broken	helpers/html_helpers.py → process_paragraph_html()
Admin can't see documents	routes/admin.py → api_admin_get_documents()
User approval not working	routes/admin.py → api_approve_user()