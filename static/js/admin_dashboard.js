// ==================== ADMIN DASHBOARD JS ====================

let allDocuments = [];
let allUsers = [];
let currentEditDocId = null;
let currentFilter = 'all';
let searchDebounceTimer = null;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function () {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    loadAdminStats();
    loadUsers();
    loadDocuments();
    updateAdminSortIndicators();
});

function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.textContent = now.toLocaleDateString('en-US', options);
    }
}

// ==================== TOAST NOTIFICATIONS (SINGLE UNIFIED VERSION) ====================

/**
 * showToast(title, message, type)  ← 3-arg form  (used by save/edit/user functions)
 * showToast(message, type)         ← 2-arg form  (used by print/cancel functions)
 * Both forms work with this single function.
 */
function showToast(titleOrMessage, messageOrType, type) {
    // ── Detect which form was called ─────────────────────────────
    let title, message, toastType;

    if (type !== undefined) {
        // 3-arg form: showToast(title, message, type)
        title = titleOrMessage;
        message = messageOrType;
        toastType = type;
    } else {
        // 2-arg form: showToast(message, type)
        title = null;
        message = titleOrMessage;
        toastType = messageOrType || 'info';
    }

    // Normalise type aliases
    if (toastType === 'danger') toastType = 'error';

    // ── Icon + colours ────────────────────────────────────────────
    const config = {
        success: {
            bg: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            border: '#0d8c6b',
            icon: 'bi-check-circle-fill',
            color: '#fff',
            title: title || 'Success'
        },
        error: {
            bg: 'linear-gradient(135deg, #e94560 0%, #ff6b6b 100%)',
            border: '#c0392b',
            icon: 'bi-x-circle-fill',
            color: '#fff',
            title: title || 'Error'
        },
        warning: {
            bg: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
            border: '#d68910',
            icon: 'bi-exclamation-triangle-fill',
            color: '#1a1a2e',
            title: title || 'Warning'
        },
        info: {
            bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            border: '#0984c9',
            icon: 'bi-info-circle-fill',
            color: '#fff',
            title: title || 'Info'
        }
    };

    const cfg = config[toastType] || config.info;

    // ── Find or create toast container ────────────────────────────
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    // ── Build toast element ───────────────────────────────────────
    const toastEl = document.createElement('div');
    toastEl.className = 'toast show';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.style.cssText = `
        min-width: 300px;
        max-width: 400px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        border: none;
        margin-bottom: 10px;
        animation: slideInToast 0.35s cubic-bezier(.21,1.02,.73,1) both;
    `;

    toastEl.innerHTML = `
        <div style="
            background: ${cfg.bg};
            padding: 14px 16px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        ">
            <!-- Icon -->
            <div style="
                width: 36px;
                height: 36px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-top: 1px;
            ">
                <i class="bi ${cfg.icon}" style="font-size: 1rem; color: ${cfg.color};"></i>
            </div>

            <!-- Text -->
            <div style="flex: 1; min-width: 0;">
                <div style="
                    font-weight: 700;
                    font-size: 0.875rem;
                    color: ${cfg.color};
                    line-height: 1.3;
                    margin-bottom: 2px;
                ">${cfg.title}</div>
                <div style="
                    font-size: 0.8125rem;
                    color: ${cfg.color};
                    opacity: 0.9;
                    line-height: 1.4;
                    word-break: break-word;
                ">${message}</div>
            </div>

            <!-- Close button -->
            <button
                type="button"
                onclick="this.closest('.toast').remove()"
                style="
                    background: rgba(255,255,255,0.2);
                    border: none;
                    border-radius: 50%;
                    width: 26px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    color: ${cfg.color};
                    font-size: 0.75rem;
                    transition: background 0.2s;
                "
                onmouseover="this.style.background='rgba(255,255,255,0.35)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'"
            >
                <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <!-- Progress bar -->
        <div style="
            height: 3px;
            background: rgba(255,255,255,0.25);
            border-radius: 0 0 12px 12px;
            overflow: hidden;
        ">
            <div class="toast-progress-bar" style="
                height: 100%;
                width: 100%;
                background: rgba(255,255,255,0.6);
                transform-origin: left;
                animation: toastProgress 4s linear forwards;
            "></div>
        </div>
    `;

    // ── Add animation keyframes once ─────────────────────────────
    if (!document.getElementById('toast-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframes';
        style.textContent = `
            @keyframes slideInToast {
                from { transform: translateX(110%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }
            @keyframes slideOutToast {
                from { transform: translateX(0);    opacity: 1; max-height: 200px; margin-bottom: 10px; }
                to   { transform: translateX(110%); opacity: 0; max-height: 0;     margin-bottom: 0;  }
            }
            @keyframes toastProgress {
                from { transform: scaleX(1); }
                to   { transform: scaleX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    container.appendChild(toastEl);

    // ── Auto-dismiss after 4 seconds ─────────────────────────────
    setTimeout(() => {
        toastEl.style.animation = 'slideOutToast 0.4s ease forwards';
        setTimeout(() => toastEl.remove(), 400);
    }, 4000);
}

// ==================== LOAD ADMIN STATS ====================

async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();

        if (data.success) {
            const overall = data.overall;

            document.getElementById('totalUsers').textContent = overall.total_users || 0;
            document.getElementById('activeUsers').textContent = overall.active_users || 0;
            document.getElementById('totalDocuments').textContent = overall.total_documents || 0;
            document.getElementById('generatedDocs').textContent = overall.generated || 0;

            document.getElementById('overviewDrafts').textContent = overall.drafts || 0;
            document.getElementById('overviewPending').textContent = overall.pending || 0;
            document.getElementById('overviewApproved').textContent = overall.approved || 0;
            document.getElementById('overviewGenerated').textContent = overall.generated || 0;

            renderUserActivity(data.users || []);
        }
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

function renderUserActivity(users) {
    const tbody = document.getElementById('userActivityBody');
    if (!tbody) return;

    // Store so sort buttons can re-render without re-fetching
    allOverviewUsers = users;

    // Apply current sort
    const sorted = sortAdminData(users, 'overview');

    if (sorted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    No user activity found
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = sorted.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.stats?.drafts || 0}</td>
            <td>${user.stats?.pending || 0}</td>
            <td>${user.stats?.approved || 0}</td>
            <td>${user.stats?.generated || 0}</td>
            <td>${user.last_login
            ? formatDate(user.last_login)
            : '<span class="text-muted">Never</span>'
        }</td>
        </tr>
    `).join('');
}

// ==================== LOAD USERS ====================

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();

        if (data.success) {
            allUsers = data.users || [];
            renderUsers(allUsers);
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('usersEmptyState');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    // Apply current sort
    const sorted = sortAdminData(users, 'adminUsers');

    tbody.innerHTML = sorted.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>
                ${user.is_active
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-danger">Inactive</span>'}
                ${user.is_approved
            ? '<span class="badge bg-info ms-1">Approved</span>'
            : '<span class="badge bg-warning ms-1">Pending</span>'}
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>${user.last_login
            ? formatDate(user.last_login)
            : '<span class="text-muted">Never</span>'
        }</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1"
                        onclick="editUser('${user.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                ${!user.is_approved ? `
                    <button class="btn btn-sm btn-success me-1"
                            onclick="approveUser('${user.id}')" title="Approve">
                        <i class="bi bi-check-lg"></i>
                    </button>
                ` : `
                    <button class="btn btn-sm btn-warning me-1"
                            onclick="rejectUser('${user.id}')" title="Revoke">
                        <i class="bi bi-x-lg"></i>
                    </button>
                `}
                <button class="btn btn-sm btn-outline-${user.is_active ? 'warning' : 'success'} me-1"
                        onclick="toggleUserStatus('${user.id}')"
                        title="${user.is_active ? 'Deactivate' : 'Activate'}">
                    <i class="bi bi-${user.is_active ? 'pause' : 'play'}"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger"
                        onclick="deleteUser('${user.id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== USER MANAGEMENT FUNCTIONS ====================

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('newUserPassword').value = 'Ayraservices@123';
    const modal = new bootstrap.Modal(document.getElementById('addUserModal'));
    modal.show();
}

function generateRandomPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('newUserPassword').value = password;
}

function resetToDefaultPassword() {
    document.getElementById('newUserPassword').value = 'Ayraservices@123';
}

async function createUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const phone = document.getElementById('newUserPhone').value.trim();
    const password = document.getElementById('newUserPassword').value;

    if (!name || !email) {
        showToast('Error', 'Name and email are required', 'error');
        return;
    }

    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', 'User created successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            loadUsers();
            loadAdminStats();
        } else {
            showToast('Error', data.message || 'Failed to create user', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

function editUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserName').value = user.name;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserPassword').value = '';

    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
}

async function updateUser() {
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();
    const phone = document.getElementById('editUserPhone').value.trim();
    const password = document.getElementById('editUserPassword').value;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password: password || undefined })
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', 'User updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            loadUsers();
        } else {
            showToast('Error', data.message || 'Failed to update user', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

async function approveUser(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', data.message || 'User approved', 'success');
            loadUsers();
        } else {
            showToast('Error', data.message || 'Failed to approve user', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

async function rejectUser(userId) {
    if (!confirm('Are you sure you want to revoke approval for this user?')) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', data.message || 'Approval revoked', 'success');
            loadUsers();
        } else {
            showToast('Error', data.message || 'Failed to revoke approval', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

async function toggleUserStatus(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', data.message, 'success');
            loadUsers();
        } else {
            showToast('Error', data.message || 'Failed to toggle status', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', 'User deleted successfully', 'success');
            loadUsers();
            loadAdminStats();
        } else {
            showToast('Error', data.message || 'Failed to delete user', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

// ==================== LOAD DOCUMENTS ====================

async function loadDocuments() {
    try {
        const response = await fetch('/api/admin/documents');
        const data = await response.json();

        if (data.success) {
            allDocuments = data.documents || [];
            renderDocuments(allDocuments);

            // Only apply filters if any are active
            const hasUserFilter = document.getElementById('filterUserName')?.value?.trim();
            const hasOldNameFilter = document.getElementById('filterOldName')?.value?.trim();
            const hasStatusFilter = typeof _docFilterStatus !== 'undefined'
                && _docFilterStatus !== 'all';

            if (hasUserFilter || hasOldNameFilter || hasStatusFilter) {
                if (typeof applyDocFilters === 'function') {
                    applyDocFilters();
                }
            }
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function renderDocuments(documents) {
    const tbody = document.getElementById('adminDocsTableBody');
    const emptyState = document.getElementById('adminDocsEmptyState');

    if (!tbody) return;

    let filteredDocs = documents;
    if (currentFilter !== 'all') {
        filteredDocs = documents.filter(d => d.status === currentFilter);
    }
    filteredDocs = sortAdminData(filteredDocs, 'adminDocs');

    if (filteredDocs.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }

    if (emptyState) emptyState.classList.add('d-none');

    tbody.innerHTML = filteredDocs.map(doc => {
        const isPublished = doc.published === true;

        return `
        <tr
            data-doc-id="${doc.id}"
            data-user-name="${doc.user_name || ''}"
            data-old-name="${doc.old_name || ''}"
            data-status="${(doc.status || '').toLowerCase()}">
            <td>
                <input type="checkbox" class="form-check-input doc-checkbox"
                       data-doc-id="${doc.id}" onchange="updateSelectedCount()">
            </td>
            <td><strong>${doc.user_name || 'Unknown'}</strong></td>
            <td>${doc.template_type === 'minor_template' && doc.replacements?.['FATHER-MOTHER_NAME']
                ? doc.replacements['FATHER-MOTHER_NAME']
                : (doc.old_name || '-')
            }</td>
            <td><span class="badge bg-secondary">${doc.template_name || doc.template_type}</span></td>
            <td>${getStatusBadge(doc.status)}</td>
            <td>
                <span class="badge ${isPublished ? 'badge-published' : 'badge-unpublished'}">
                    <i class="bi bi-${isPublished ? 'check-circle' : 'circle'} me-1"></i>
                    ${isPublished ? 'Published' : 'Unpublished'}
                </span>
            </td>
            <td>${formatDate(doc.modified_at)}</td>
            <td class="action-buttons-cell">
                <button class="btn btn-view btn-sm" onclick="viewDocument('${doc.id}')" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-edit btn-sm" onclick="editDocument('${doc.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-print btn-sm" onclick="showPrintProgress('${doc.id}')" title="Print Preview">
                    <i class="bi bi-printer"></i>
                </button>
                <button class="btn btn-download-all btn-sm" onclick="downloadAllFiles('${doc.id}')" title="Download All">
                    <i class="bi bi-file-zip"></i>
                </button>
                <button class="btn btn-download-cd btn-sm" onclick="downloadCDOnly('${doc.id}')" title="Download CD">
                    <i class="bi bi-file-earmark-word"></i>
                </button>
                <button class="btn btn-sm ${isPublished ? 'btn-published' : 'btn-publish'}"
                        onclick="togglePublish('${doc.id}')"
                        title="${isPublished ? 'Click to Unpublish' : 'Click to Publish'}">
                    <i class="bi bi-${isPublished ? 'eye-slash' : 'eye'}"></i>
                    ${isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button class="btn btn-delete btn-sm" onclick="deleteDocument('${doc.id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    updateSelectedCount();
}

function getStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge bg-warning text-dark">Draft</span>',
        'pending': '<span class="badge bg-info">Pending</span>',
        'approved': '<span class="badge bg-success">Approved</span>',
        'generated': '<span class="badge bg-primary">Generated</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

function setStatusFilter(filter, btn) {
    currentFilter = filter;

    document.querySelectorAll('.btn-group .btn').forEach(b => {
        b.classList.remove('active');
    });
    if (btn) btn.classList.add('active');

    renderDocuments(allDocuments);
}

// ==================== SEARCH / FILTER ====================

function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyDocFilters, 300);
}

function applyDocFilters() {
    const userName = (document.getElementById('filterUserName')?.value || '').trim().toLowerCase();
    const oldName = (document.getElementById('filterOldName')?.value || '').trim().toLowerCase();
    const status = (typeof _docFilterStatus !== 'undefined') ? _docFilterStatus : 'all';

    const rows = document.querySelectorAll('#adminDocsTableBody tr');
    let visible = 0;

    rows.forEach(row => {
        const rowUser = (row.dataset.userName || '').toLowerCase();
        const rowOld = (row.dataset.oldName || '').toLowerCase();
        const rowStatus = (row.dataset.status || '').toLowerCase();

        const matchUser = !userName || rowUser.includes(userName);
        const matchOld = !oldName || rowOld.includes(oldName);
        const matchStatus = (status === 'all') || (rowStatus === status);

        const show = matchUser && matchOld && matchStatus;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
    });

    updateFilterInfoBar(userName, oldName, status, visible, rows.length);

    const emptyState = document.getElementById('adminDocsEmptyState');
    if (emptyState) emptyState.classList.toggle('d-none', visible > 0);
}

function updateFilterInfoBar(userName, oldName, status, visible, total) {
    const bar = document.getElementById('filterInfoBar');
    const infoText = document.getElementById('filterInfoText');
    if (!bar || !infoText) return;

    const parts = [];
    if (userName) parts.push(`User: "<strong>${escapeHtml(userName)}</strong>"`);
    if (oldName) parts.push(`Old Name: "<strong>${escapeHtml(oldName)}</strong>"`);
    if (status !== 'all') parts.push(`Status: <strong>${capitalize(status)}</strong>`);

    if (parts.length === 0) {
        bar.classList.add('d-none');
    } else {
        bar.classList.remove('d-none');
        infoText.innerHTML =
            `${parts.join(' · ')} — showing <strong>${visible}</strong> of <strong>${total}</strong> records`;
    }
}

function clearDocFilters() {
    const uInput = document.getElementById('filterUserName');
    const oInput = document.getElementById('filterOldName');
    if (uInput) uInput.value = '';
    if (oInput) oInput.value = '';

    if (typeof _docFilterStatus !== 'undefined') {
        _docFilterStatus = 'all';
    }

    const allBtn = document.querySelector('.doc-status-btn[data-status="all"]');
    if (allBtn) {
        document.querySelectorAll('.doc-status-btn').forEach(b => {
            const isActive = b === allBtn;
            b.style.background = isActive ? 'var(--ink)' : '#fff';
            b.style.color = isActive ? '#fff' : 'var(--ink-muted)';
            b.style.borderColor = isActive ? 'var(--ink)' : 'var(--rule)';
        });
    }

    applyDocFilters();
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ==================== RELOAD DOCS KEEPING FILTERS ====================

async function reloadDocsKeepFilters() {
    const savedUserFilter = document.getElementById('filterUserName')?.value || '';
    const savedOldNameFilter = document.getElementById('filterOldName')?.value || '';
    const savedStatus = (typeof _docFilterStatus !== 'undefined') ? _docFilterStatus : 'all';

    try {
        const response = await fetch('/api/admin/documents');
        const data = await response.json();

        if (data.success) {
            allDocuments = data.documents || [];
            renderDocuments(allDocuments);
        }
    } catch (error) {
        console.error('Error reloading documents:', error);
        return;
    }

    // Restore inputs
    const userInput = document.getElementById('filterUserName');
    if (userInput) userInput.value = savedUserFilter;

    const oldNameInput = document.getElementById('filterOldName');
    if (oldNameInput) oldNameInput.value = savedOldNameFilter;

    // Restore status button
    if (typeof _docFilterStatus !== 'undefined') {
        _docFilterStatus = savedStatus;
    }

    const statusBtn = document.querySelector(`.doc-status-btn[data-status="${savedStatus}"]`);
    if (statusBtn) {
        document.querySelectorAll('.doc-status-btn').forEach(b => {
            const isActive = b === statusBtn;
            b.style.background = isActive ? 'var(--ink)' : '#fff';
            b.style.color = isActive ? '#fff' : 'var(--ink-muted)';
            b.style.borderColor = isActive ? 'var(--ink)' : 'var(--rule)';
        });
    }

    if (typeof applyDocFilters === 'function') {
        applyDocFilters();
    }
}

// ==================== DOCUMENT SELECTION ====================

function toggleSelectAllDocs() {
    const selectAll = document.getElementById('selectAllDocs');
    const checkboxes = document.querySelectorAll('.doc-checkbox');

    checkboxes.forEach(cb => {
        if (cb.closest('tr').style.display !== 'none') {
            cb.checked = selectAll.checked;
        }
    });

    updateSelectedCount();
}

function updateSelectedCount() {
    const checked = document.querySelectorAll('.doc-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = checked;
    document.getElementById('bulkDownloadBtn').disabled = checked === 0;
}

async function downloadSelectedDocs() {
    const checked = document.querySelectorAll('.doc-checkbox:checked');
    const docIds = Array.from(checked).map(cb => cb.getAttribute('data-doc-id'));

    if (docIds.length === 0) {
        showToast('Warning', 'No documents selected', 'warning');
        return;
    }

    try {
        showToast('Info', 'Preparing download...', 'info');

        const response = await fetch('/api/admin/documents/download-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ doc_ids: docIds })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bulk_documents_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Success', 'Download started', 'success');
        } else {
            const data = await response.json();
            showToast('Error', data.message || 'Download failed', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error during download', 'error');
    }
}

// ==================== VIEW DOCUMENT ====================

async function viewDocument(docId) {
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;

    const replacements = doc.replacements || {};
    const modalBody = document.getElementById('viewDocBody');
    const isPublished = doc.published === true;

    let html = `
        <div class="view-doc-badge-container">
            ${getStatusBadge(doc.status)}
            <span class="badge ${isPublished ? 'badge-published' : 'badge-unpublished'}">
                <i class="bi bi-${isPublished ? 'check-circle' : 'circle'} me-1"></i>
                ${isPublished ? 'Published' : 'Unpublished'}
            </span>
            <span class="badge bg-secondary">${doc.template_name || doc.template_type}</span>
            <span class="badge bg-dark">User: ${doc.user_name || 'Unknown'}</span>
        </div>

        <div class="cd-document-section">
            <div class="cd-document-header">
                <div class="cd-document-icon"><i class="bi bi-file-earmark-text"></i></div>
                <h6 class="cd-document-title">CD Document Preview</h6>
            </div>
            <div class="cd-copy-btn-container">
                <button class="cd-copy-btn" onclick="copyCdContent('viewCdContent')">
                    <i class="bi bi-clipboard"></i> Copy Content
                </button>
            </div>
            <div id="viewCdContent" class="cd-document-content">
                <div class="cd-loading">
                    <i class="bi bi-arrow-repeat"></i>
                    <p>Loading CD preview...</p>
                </div>
            </div>
        </div>

        <hr class="my-4">
        <h6 class="text-muted mb-3"><i class="bi bi-list-ul me-2"></i>Document Details</h6>
    `;

    html += buildViewSection('Personal Details', 'person-fill', 'personal', [
        { label: 'Old Name', value: replacements.OLD_NAME },
        { label: 'New Name', value: replacements.NEW_NAME },
        { label: 'Relation', value: replacements.UPDATE_RELATION },
        { label: 'Father/Spouse Name', value: replacements['FATHER-SPOUSE_NAME'] },
        { label: 'Wife Of', value: replacements.WIFE_OF ? 'Yes' : '' },
        { label: 'Spouse Name', value: replacements.SPOUSE_NAME1 },
        { label: 'Gender', value: replacements.GENDER_UPDATE },
        { label: 'Cast', value: replacements.CAST_UPDATE }
    ]);

    html += buildViewSection('Contact Details', 'telephone-fill', 'contact', [
        { label: 'Phone', value: replacements.PHONE_UPDATE },
        { label: 'Email', value: replacements.EMAIL_UPDATE },
        { label: 'Address', value: replacements.UPDATE_ADDRESS }
    ]);

    html += buildViewSection('Date Details', 'calendar-event', 'dates', [
        { label: 'Numeric Date', value: replacements.NUM_DATE },
        { label: 'Alphabetic Date', value: replacements.ALPHA_DATE }
    ]);

    html += buildViewSection('Witness 1 Details', 'person-badge', 'witness', [
        { label: 'Name', value: replacements.WITNESS_NAME1 },
        { label: 'Phone', value: replacements.WITNESS_PHONE1 },
        { label: 'Address', value: replacements.WITNESS_ADDRESS1 }
    ]);

    html += buildViewSection('Witness 2 Details', 'person-badge-fill', 'witness', [
        { label: 'Name', value: replacements.WITNESS_NAME2 },
        { label: 'Phone', value: replacements.WITNESS_PHONE2 },
        { label: 'Address', value: replacements.WITNESS_ADDRESS2 }
    ]);

    if (doc.template_type === 'minor_template') {
        html += buildViewSection('Child Details', 'emoji-smile', 'child', [
            { label: 'Father/Mother Name', value: replacements['FATHER-MOTHER_NAME'] },
            { label: 'Son/Daughter', value: replacements['SON-DAUGHTER'] },
            { label: 'Age', value: replacements.UPDATE_AGE },
            { label: 'Date of Birth', value: replacements.CHILD_DOB },
            { label: 'Birth Place', value: replacements.BIRTH_PLACE }
        ]);
    }

    modalBody.innerHTML = html;

    const modal = new bootstrap.Modal(document.getElementById('viewDocModal'));
    modal.show();

    loadCDPreview(docId, 'viewCdContent');
}

function buildViewSection(title, icon, sectionClass, fields) {
    const filledFields = fields.filter(f => f.value && f.value.toString().trim());
    if (filledFields.length === 0) return '';

    return `
        <div class="view-doc-section ${sectionClass}">
            <div class="view-doc-section-header">
                <div class="view-doc-section-icon"><i class="bi bi-${icon}"></i></div>
                <h6 class="view-doc-section-title">${title}</h6>
            </div>
            <div class="row">
                ${filledFields.map(f => `
                    <div class="col-md-6">
                        <div class="view-doc-field">
                            <span class="view-doc-label">${f.label}</span>
                            <span class="view-doc-value">${f.value}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function loadCDPreview(docId, containerId) {
    try {
        const response = await fetch(`/api/admin/documents/${docId}/cd-preview`);
        const data = await response.json();

        const container = document.getElementById(containerId);
        if (data.success) {
            container.innerHTML = data.cd_content;
        } else {
            container.innerHTML = `
                <div class="text-center text-muted py-3">
                    ${data.message || 'Could not load preview'}
                </div>`;
        }
    } catch (error) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center text-danger py-3">Error loading preview</div>`;
        }
    }
}

function copyCdContent(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const text = container.innerText || container.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const btn = container.parentElement.querySelector('.cd-copy-btn');
        if (btn) {
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.remove('copied');
            }, 2000);
        }
        showToast('Success', 'Content copied to clipboard', 'success');
    }).catch(() => {
        showToast('Error', 'Failed to copy content', 'error');
    });
}

// ==================== EDIT DOCUMENT ====================

function editDocument(docId) {
    currentEditDocId = docId;
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('editDocTemplateBadge').textContent =
        doc.template_name || doc.template_type;

    const modalBody = document.getElementById('editDocBody');
    modalBody.innerHTML = buildEditForm(doc);

    // ── Populate existing aliases ──────────────────────────────
    const r = doc.replacements || {};
    const { aliases: parsedAliases } = parseOldNameWithAliases(r.OLD_NAME || '');
    parsedAliases.forEach(function (aliasVal) {
        addEditAliasField(aliasVal);
    });

    // Trigger preview if aliases exist
    if (parsedAliases.length > 0) {
        updateEditAliasPreview();
    }
    // ────────────────────────────────────────────────────────────

    const modal = new bootstrap.Modal(document.getElementById('editDocModal'));
    modal.show();

    setTimeout(() => {
        loadCDPreview(docId, 'editCdContent');
    }, 300);
}

function buildEditForm(doc) {
    const r = doc.replacements || {};
    const previewData = doc.preview_data || {};
    const folderType = previewData.folder_type || 'main';
    const relation = r.UPDATE_RELATION || '';
    const hasSpouse = r.WIFE_OF && r.SPOUSE_NAME1;

    // Parse aliases from OLD_NAME
    const { baseName: parsedBaseName, aliases: parsedAliases } = parseOldNameWithAliases(r.OLD_NAME || '');

    // Reset alias counter
    editAliasCounter = 0;

    let html = `<input type="hidden" id="editDocId" value="${doc.id}">`;

    // ── CD Preview Section (common for all templates) ──────────
    html += `
        <div class="cd-document-section mb-4">
            <div class="cd-document-header">
                <div class="cd-document-icon"><i class="bi bi-file-earmark-text"></i></div>
                <div>
                    <h6 class="cd-document-title mb-0">CD Document Preview (Live)</h6>
                    <small class="text-muted" style="color:#92400e !important;">
                        Updates when you save changes
                    </small>
                </div>
            </div>
            <div class="cd-copy-btn-container">
                <button type="button" class="cd-copy-btn" onclick="copyCdContent('editCdContent')">
                    <i class="bi bi-clipboard"></i> Copy Content
                </button>
                <button type="button" class="btn btn-outline-warning btn-sm ms-2"
                        onclick="refreshCdPreviewFromForm()">
                    <i class="bi bi-arrow-clockwise"></i> Preview Changes
                </button>
            </div>
            <div id="editCdContent" class="cd-document-content">
                <div class="cd-loading">
                    <i class="bi bi-arrow-repeat"></i>
                    <p>Loading CD preview...</p>
                </div>
            </div>
        </div>

        <hr class="my-4">
        <h6 class="text-primary mb-3">
            <i class="bi bi-pencil-square me-2"></i>Edit Document Details
        </h6>
    `;

    // ============================================================
    // MINOR TEMPLATE - completely separate layout
    // ============================================================
    if (doc.template_type === 'minor_template') {

        // ── Section 1: Parent/Guardian Details ──────────────────
        html += `
            <div class="form-section">
                <div class="section-header">
                    <div class="section-icon" style="background:var(--primary-gray,#6c757d);">
                        <i class="bi bi-people-fill"></i>
                    </div>
                    <h6 class="section-title">Parent / Guardian Details</h6>
                </div>
                <div class="row g-3">

                    <div class="col-md-6">
                        <label class="form-label">
                            Father/Mother Name <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person-heart"></i></span>
                            <input type="text" class="form-control" id="editFatherMother"
                                   value="${escapeHtml(r['FATHER-MOTHER_NAME'] || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">
                            Relationship <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-people"></i></span>
                            <select class="form-select" id="editRelation"
                                    onchange="handleMinorRelationChangeEdit()">
                                <option value="">Select...</option>
                                <option value="S/o" ${relation === 'S/o' ? 'selected' : ''}>S/o</option>
                                <option value="D/o" ${relation === 'D/o' ? 'selected' : ''}>D/o</option>
                                <option value="W/o" ${relation === 'W/o' ? 'selected' : ''}>W/o</option>
                                <option value="D/o & W/o" ${relation === 'D/o & W/o' ? 'selected' : ''}>D/o & W/o</option>
                            </select>
                        </div>
                    </div>

                    <!-- Normal Guardian Spouse Field -->
                    <div class="col-md-6" id="editMinorNormalSpouseField"
                         style="display:${relation === 'D/o & W/o' ? 'none' : 'block'};">
                        <label class="form-label">
                            Guardian Spouse <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person"></i></span>
                            <input type="text" class="form-control" id="editFatherSpouse"
                                   value="${escapeHtml(r['FATHER-SPOUSE_NAME'] || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <!-- Dual Relation Fields (D/o & W/o) -->
                    <div class="col-12" id="editMinorDualRelationFields"
                         style="display:${relation === 'D/o & W/o' ? 'block' : 'none'};">
                        <div class="dual-relation-card">
                            <div class="card-header">
                                <i class="bi bi-people-fill me-2"></i>D/o & W/o - Guardian Names
                            </div>
                            <div class="card-body p-3">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">
                                            Guardian's Father <span class="required-asterisk">*</span>
                                        </label>
                                        <div class="input-group">
                                            <span class="input-group-text"
                                                  style="background:var(--primary-dark,#1a1a1a);
                                                         color:white;">D/o</span>
                                            <input type="text" class="form-control"
                                                   id="editGuardianFather"
                                                   value="${escapeHtml(r.GUARDIAN_FATHER_NAME || r['FATHER-SPOUSE_NAME'] || '')}"
                                                   style="text-transform:uppercase;"
                                                   oninput="this.value=this.value.toUpperCase();">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">
                                            Guardian's Husband <span class="required-asterisk">*</span>
                                        </label>
                                        <div class="input-group">
                                            <span class="input-group-text"
                                                  style="background:var(--primary-gray,#6c757d);
                                                         color:white;">W/o</span>
                                            <input type="text" class="form-control"
                                                   id="editGuardianSpouse"
                                                   value="${escapeHtml(r.GUARDIAN_SPOUSE_NAME || r.SPOUSE_NAME1 || '')}"
                                                   style="text-transform:uppercase;"
                                                   oninput="this.value=this.value.toUpperCase();">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">
                            Address <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-house"></i></span>
                            <input type="text" class="form-control" id="editAddress"
                                   value="${escapeHtml(r.UPDATE_ADDRESS || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">
                            Phone <span class="required-asterisk">*</span>
                        </label>
                        <input type="tel" class="form-control" id="editPhone"
                               value="${escapeHtml(r.PHONE_UPDATE || '')}" maxlength="10">
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">
                            Email <span class="required-asterisk">*</span>
                        </label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                            <input type="text" class="form-control" id="editEmail"
                                   value="${escapeHtml(r.EMAIL_UPDATE || '')}">
                        </div>
                    </div>

                </div>
            </div>
        `;

        // ── Section 2: Child Details ─────────────────────────────
        html += `
            <div class="form-section">
                <div class="section-header">
                    <div class="section-icon" style="background:var(--primary-gray,#6c757d);">
                        <i class="bi bi-emoji-smile"></i>
                    </div>
                    <h6 class="section-title">Child Details</h6>
                </div>
                <div class="row g-3">

                    <!-- Child Old Name with Alias -->
                    <div class="col-md-6">
                        <label class="form-label">
                            Child Old Name <span class="required-asterisk">*</span>
                            <small class="text-muted">(+alias)</small>
                        </label>
                        <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                            <div class="input-group flex-grow-1">
                                <span class="input-group-text"><i class="bi bi-person"></i></span>
                                <input type="text" class="form-control" id="editOldName"
                                       value="${escapeHtml(parsedBaseName)}"
                                       style="text-transform:uppercase;"
                                       oninput="this.value=this.value.toUpperCase();
                                                updateEditAliasPreview();">
                            </div>
                            <button type="button"
                                    title="Add Alias"
                                    onclick="addEditAliasField()"
                                    style="background:linear-gradient(135deg,#1a1a1a 0%,#444 100%);
                                           border:none; color:white; padding:0;
                                           border-radius:8px; width:42px; height:42px;
                                           min-width:42px; display:flex; align-items:center;
                                           justify-content:center; cursor:pointer;
                                           flex-shrink:0; transition:all 0.2s ease;"
                                    onmouseover="this.style.opacity='0.85'"
                                    onmouseout="this.style.opacity='1'">
                                <i class="bi bi-plus-lg"></i>
                            </button>
                        </div>

                        <!-- Alias fields container -->
                        <div id="editAliasContainer" style="margin-top:0.5rem;"></div>

                        <!-- Alias counter -->
                        <div id="editAliasCounter"
                             style="display:none; margin-top:0.5rem; padding:0.35rem 0.65rem;
                                    background:#f8f9fa; border-radius:6px;
                                    font-size:0.75rem; color:#6c757d;">
                            <i class="bi bi-tags me-1"></i>Aliases: <span class="count">0</span>
                        </div>

                        <!-- Alias preview -->
                        <div id="editAliasPreview"
                             style="display:none; margin-top:0.75rem; padding:0.75rem;
                                    background:#f8f9fa; border-radius:8px;
                                    border:1px solid #dee2e6;">
                            <div style="font-size:0.75rem; font-weight:600; color:#6c757d;
                                        margin-bottom:0.5rem; text-transform:uppercase;
                                        letter-spacing:0.3px;">
                                <i class="bi bi-eye me-1"></i>Preview:
                            </div>
                            <div id="editAliasPreviewText" style="word-break:break-word;"></div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Child New Name <span class="required-asterisk">*</span></label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person-check"></i></span>
                            <input type="text" class="form-control" id="editNewName"
                                   value="${escapeHtml(r.NEW_NAME || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Gender <span class="required-asterisk">*</span></label>
                        <select class="form-select" id="editGender">
                            <option value="">Select...</option>
                            <option value="MALE"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'MALE' ? 'selected' : ''}>
                                Male
                            </option>
                            <option value="FEMALE"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'FEMALE' ? 'selected' : ''}>
                                Female
                            </option>
                            <option value="OTHER"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'OTHER' ? 'selected' : ''}>
                                Other
                            </option>
                        </select>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Son/Daughter <span class="required-asterisk">*</span></label>
                        <select class="form-select" id="editSonDaughter">
                            <option value="">Select...</option>
                            <option value="son"
                                ${(r['SON-DAUGHTER'] || '').toLowerCase() === 'son' ? 'selected' : ''}>
                                Son
                            </option>
                            <option value="daughter"
                                ${(r['SON-DAUGHTER'] || '').toLowerCase() === 'daughter' ? 'selected' : ''}>
                                Daughter
                            </option>
                        </select>
                    </div>

                    <div class="col-md-4">
                        <label class="form-label">Date of Birth <span class="required-asterisk">*</span></label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-calendar"></i></span>
                            <input type="text" class="form-control" id="editChildDob"
                                   value="${escapeHtml(r.CHILD_DOB || '')}"
                                   placeholder="DD/MM/YYYY">
                        </div>
                    </div>

                    <div class="col-md-4">
                        <label class="form-label">Age <span class="required-asterisk">*</span></label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-hash"></i></span>
                            <input type="number" class="form-control" id="editAge"
                                   value="${escapeHtml(String(r.UPDATE_AGE || ''))}"
                                   min="0" max="17">
                            <span class="input-group-text">years</span>
                        </div>
                    </div>

                    <div class="col-md-4">
                        <label class="form-label">Birth Place <span class="required-asterisk">*</span></label>
                        <input type="text" class="form-control" id="editBirthPlace"
                               value="${escapeHtml(r.BIRTH_PLACE || '')}"
                               style="text-transform:uppercase;"
                               oninput="this.value=this.value.toUpperCase();">
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Religion/Cast <span class="required-asterisk">*</span></label>
                        <input type="text" class="form-control" id="editCast"
                               value="${escapeHtml(r.CAST_UPDATE || '')}"
                               style="text-transform:uppercase;"
                               oninput="this.value=this.value.toUpperCase();">
                    </div>

                </div>
            </div>
        `;

    } else {
        // ============================================================
        // MAJOR & RELIGION TEMPLATES - Personal Details
        // ============================================================
        html += `
            <div class="form-section">
                <div class="section-header">
                    <div class="section-icon"><i class="bi bi-person-fill"></i></div>
                    <h6 class="section-title">Personal Details</h6>
                </div>
                <div class="row g-3">

                    <!-- Old Name with Alias -->
                    <div class="col-md-6">
                        <label class="form-label">
                            Old Name <span class="required-asterisk">*</span>
                            <small class="text-muted">(+alias)</small>
                        </label>
                        <div style="display:flex; gap:0.5rem; align-items:flex-start;">
                            <div class="input-group flex-grow-1">
                                <span class="input-group-text"><i class="bi bi-person"></i></span>
                                <input type="text" class="form-control" id="editOldName"
                                       value="${escapeHtml(parsedBaseName)}"
                                       style="text-transform:uppercase;"
                                       oninput="this.value=this.value.toUpperCase();
                                                updateEditAliasPreview();">
                            </div>
                            <button type="button"
                                    title="Add Alias"
                                    onclick="addEditAliasField()"
                                    style="background:linear-gradient(135deg,#1a1a1a 0%,#444 100%);
                                           border:none; color:white; padding:0;
                                           border-radius:8px; width:42px; height:42px;
                                           min-width:42px; display:flex; align-items:center;
                                           justify-content:center; cursor:pointer;
                                           flex-shrink:0; transition:all 0.2s ease;"
                                    onmouseover="this.style.opacity='0.85'"
                                    onmouseout="this.style.opacity='1'">
                                <i class="bi bi-plus-lg"></i>
                            </button>
                        </div>

                        <!-- Alias fields container -->
                        <div id="editAliasContainer" style="margin-top:0.5rem;"></div>

                        <!-- Alias counter -->
                        <div id="editAliasCounter"
                             style="display:none; margin-top:0.5rem; padding:0.35rem 0.65rem;
                                    background:#f8f9fa; border-radius:6px;
                                    font-size:0.75rem; color:#6c757d;">
                            <i class="bi bi-tags me-1"></i>Aliases: <span class="count">0</span>
                        </div>

                        <!-- Alias preview -->
                        <div id="editAliasPreview"
                             style="display:none; margin-top:0.75rem; padding:0.75rem;
                                    background:#f8f9fa; border-radius:8px;
                                    border:1px solid #dee2e6;">
                            <div style="font-size:0.75rem; font-weight:600; color:#6c757d;
                                        margin-bottom:0.5rem; text-transform:uppercase;
                                        letter-spacing:0.3px;">
                                <i class="bi bi-eye me-1"></i>Preview:
                            </div>
                            <div id="editAliasPreviewText" style="word-break:break-word;"></div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">New Name</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person-check"></i></span>
                            <input type="text" class="form-control" id="editNewName"
                                   value="${escapeHtml(r.NEW_NAME || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Relation</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-people"></i></span>
                            <select class="form-select" id="editRelation"
                                    onchange="handleRelationChange()">
                                <option value="">Select...</option>
                                <option value="S/o" ${relation === 'S/o' ? 'selected' : ''}>
                                    S/o (Son of)
                                </option>
                                <option value="D/o" ${relation === 'D/o' ? 'selected' : ''}>
                                    D/o (Daughter of)
                                </option>
                                <option value="W/o" ${relation === 'W/o' ? 'selected' : ''}>
                                    W/o (Wife of)
                                </option>
                            </select>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Father/Spouse Name</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="bi bi-person-heart"></i></span>
                            <input type="text" class="form-control" id="editFatherSpouse"
                                   value="${escapeHtml(r['FATHER-SPOUSE_NAME'] || '')}"
                                   style="text-transform:uppercase;"
                                   oninput="this.value=this.value.toUpperCase();">
                        </div>
                    </div>

                    <!-- Dual Relation (D/o & W/o) -->
                    <div class="col-12" id="dualRelationContainer"
                         style="display:${hasSpouse || relation === 'D/o' ? 'block' : 'none'};">
                        <div class="dual-relation-card">
                            <div class="card-header">
                                <i class="bi bi-heart-fill me-2"></i>
                                D/o & W/o - Additional Spouse Details
                            </div>
                            <div class="card-body p-3">
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label class="form-label">Spouse Name</label>
                                        <input type="text" class="form-control" id="editSpouseName1"
                                               value="${escapeHtml(r.SPOUSE_NAME1 || '')}"
                                               style="text-transform:uppercase;"
                                               oninput="this.value=this.value.toUpperCase();">
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-check mt-4">
                                            <input class="form-check-input" type="checkbox"
                                                   id="editHasSpouse"
                                                   ${hasSpouse ? 'checked' : ''}
                                                   onchange="toggleSpouseFields()">
                                            <label class="form-check-label" for="editHasSpouse">
                                                Include W/o (Wife of) in document
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Gender</label>
                        <select class="form-select" id="editGender">
                            <option value="">Select...</option>
                            <option value="MALE"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'MALE' ? 'selected' : ''}>
                                Male
                            </option>
                            <option value="FEMALE"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'FEMALE' ? 'selected' : ''}>
                                Female
                            </option>
                            <option value="OTHER"
                                ${(r.GENDER_UPDATE || '').toUpperCase() === 'OTHER' ? 'selected' : ''}>
                                Other
                            </option>
                        </select>
                    </div>

                    <div class="col-md-6">
                        <label class="form-label">Religion/Cast</label>
                        <input type="text" class="form-control" id="editCast"
                               value="${escapeHtml(r.CAST_UPDATE || '')}"
                               style="text-transform:uppercase;"
                               oninput="this.value=this.value.toUpperCase();">
                    </div>

                </div>
            </div>
        `;
    }

    // ── Contact Details (common for all templates) ──────────────
    html += `
        <div class="form-section">
            <div class="section-header">
                <div class="section-icon"><i class="bi bi-telephone-fill"></i></div>
                <h6 class="section-title">Contact Details</h6>
            </div>
            <div class="row g-3">
                ${doc.template_type !== 'minor_template' ? `
                <div class="col-md-6">
                    <label class="form-label">Phone Number</label>
                    <input type="tel" class="form-control" id="editPhone"
                           value="${escapeHtml(r.PHONE_UPDATE || '')}" maxlength="10">
                </div>
                <div class="col-md-6">
                    <label class="form-label">Email</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                        <input type="text" class="form-control" id="editEmail"
                               value="${escapeHtml(r.EMAIL_UPDATE || '')}">
                    </div>
                </div>
                <div class="col-12">
                    <label class="form-label">Address</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-house"></i></span>
                        <textarea class="form-control" id="editAddress" rows="2"
                                  style="text-transform:uppercase;"
                                  oninput="this.value=this.value.toUpperCase();"
                        >${escapeHtml(r.UPDATE_ADDRESS || '')}</textarea>
                    </div>
                </div>
                ` : `
                <!-- For minor template, phone/email/address already shown above -->
                <div class="col-12">
                    <div class="alert alert-info py-2 mb-0">
                        <i class="bi bi-info-circle me-2"></i>
                        Phone, Email and Address are managed in the
                        <strong>Parent / Guardian Details</strong> section above.
                    </div>
                </div>
                `}
            </div>
        </div>
    `;

    // ── Date Details (common for all templates) ─────────────────
    html += `
        <div class="form-section">
            <div class="section-header">
                <div class="section-icon"><i class="bi bi-calendar-event"></i></div>
                <h6 class="section-title">Date Details</h6>
            </div>
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="form-label">Numeric Date</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-calendar"></i></span>
                        <input type="text" class="form-control" id="editNumDate"
                               value="${escapeHtml(r.NUM_DATE || '')}"
                               placeholder="DD/MM/YYYY">
                    </div>
                </div>
                <div class="col-md-6">
                    <label class="form-label">Alphabetic Date</label>
                    <div class="input-group">
                        <span class="input-group-text"><i class="bi bi-calendar2-check"></i></span>
                        <input type="text" class="form-control" id="editAlphaDate"
                               value="${escapeHtml(r.ALPHA_DATE || '')}"
                               placeholder="1ST JANUARY 2025">
                    </div>
                </div>
            </div>
        </div>
    `;

    // ── Witness 1 (common for all templates) ────────────────────
    html += `
        <div class="form-section">
            <div class="section-header">
                <div class="section-icon"><i class="bi bi-person-badge"></i></div>
                <h6 class="section-title">Witness 1 Details</h6>
            </div>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-control" id="editWitness1Name"
                           value="${escapeHtml(r.WITNESS_NAME1 || '')}"
                           style="text-transform:uppercase;"
                           oninput="this.value=this.value.toUpperCase();">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Phone</label>
                    <input type="tel" class="form-control" id="editWitness1Phone"
                           value="${escapeHtml(r.WITNESS_PHONE1 || '')}" maxlength="10">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Address</label>
                    <input type="text" class="form-control" id="editWitness1Address"
                           value="${escapeHtml(r.WITNESS_ADDRESS1 || '')}"
                           style="text-transform:uppercase;"
                           oninput="this.value=this.value.toUpperCase();">
                </div>
            </div>
        </div>
    `;

    // ── Witness 2 (common for all templates) ────────────────────
    html += `
        <div class="form-section">
            <div class="section-header">
                <div class="section-icon"><i class="bi bi-person-badge-fill"></i></div>
                <h6 class="section-title">Witness 2 Details</h6>
            </div>
            <div class="row g-3">
                <div class="col-md-4">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-control" id="editWitness2Name"
                           value="${escapeHtml(r.WITNESS_NAME2 || '')}"
                           style="text-transform:uppercase;"
                           oninput="this.value=this.value.toUpperCase();">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Phone</label>
                    <input type="tel" class="form-control" id="editWitness2Phone"
                           value="${escapeHtml(r.WITNESS_PHONE2 || '')}" maxlength="10">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Address</label>
                    <input type="text" class="form-control" id="editWitness2Address"
                           value="${escapeHtml(r.WITNESS_ADDRESS2 || '')}"
                           style="text-transform:uppercase;"
                           oninput="this.value=this.value.toUpperCase();">
                </div>
            </div>
        </div>
    `;

    // ── Folder Type (major & religion only) ─────────────────────
    if (doc.template_type === 'major_template' ||
        doc.template_type === 'religion_template') {
        html += `
            <div class="form-section">
                <div class="section-header">
                    <div class="section-icon"><i class="bi bi-folder"></i></div>
                    <h6 class="section-title">Template Folder</h6>
                </div>
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">Folder Type</label>
                        <select class="form-select" id="editFolderType">
                            <option value="main"
                                ${folderType === 'main' ? 'selected' : ''}>
                                Main Template (Married)
                            </option>
                            <option value="unmarried"
                                ${folderType === 'unmarried' ? 'selected' : ''}>
                                Unmarried Template
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    return html;
}

function handleRelationChange() {
    const relation = document.getElementById('editRelation').value;
    const container = document.getElementById('dualRelationContainer');

    if (relation === 'D/o' && container) {
        container.style.display = 'block';
    } else if (container) {
        container.style.display = 'none';
        const spouseInput = document.getElementById('editSpouseName1');
        const hasSpouseCheck = document.getElementById('editHasSpouse');
        if (spouseInput) spouseInput.value = '';
        if (hasSpouseCheck) hasSpouseCheck.checked = false;
    }
}

function handleMinorRelationChangeEdit() {
    const relation = document.getElementById('editRelation')?.value;
    const normalField = document.getElementById('editMinorNormalSpouseField');
    const dualField = document.getElementById('editMinorDualRelationFields');
    const spouseInput = document.getElementById('editFatherSpouse');

    if (relation === 'D/o & W/o') {
        if (normalField) normalField.style.display = 'none';
        if (dualField) dualField.style.display = 'block';
        if (spouseInput) spouseInput.value = '';
    } else {
        if (normalField) normalField.style.display = 'block';
        if (dualField) dualField.style.display = 'none';
        const guardianFather = document.getElementById('editGuardianFather');
        const guardianSpouse = document.getElementById('editGuardianSpouse');
        if (guardianFather) guardianFather.value = '';
        if (guardianSpouse) guardianSpouse.value = '';
    }
}

function toggleSpouseFields() {
    const hasSpouse = document.getElementById('editHasSpouse').checked;
    const spouseInput = document.getElementById('editSpouseName1');
    if (!hasSpouse && spouseInput) spouseInput.value = '';
}

function refreshCdPreviewFromForm() {
    if (currentEditDocId) {
        loadCDPreview(currentEditDocId, 'editCdContent');
        showToast('Info', 'Preview refreshed. Save changes first to see updates.', 'info');
    }
}

// ==================== SAVE DOCUMENT ====================

async function saveDocumentChanges() {
    const docId = document.getElementById('editDocId').value;
    const doc = allDocuments.find(d => d.id === docId);
    if (!doc) return;

    const saveBtn = document.querySelector('#editDocModal .modal-footer .btn-primary');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';
    saveBtn.disabled = true;

    const replacements = {
        OLD_NAME: buildAdminOldNameWithAliases(),
        NEW_NAME: document.getElementById('editNewName')?.value.toUpperCase().trim() || '',
        UPDATE_RELATION: document.getElementById('editRelation')?.value || '',
        'FATHER-SPOUSE_NAME': document.getElementById('editFatherSpouse')?.value.toUpperCase().trim() || '',
        GENDER_UPDATE: document.getElementById('editGender')?.value || '',
        CAST_UPDATE: document.getElementById('editCast')?.value.toUpperCase().trim() || '',
        PHONE_UPDATE: document.getElementById('editPhone')?.value.trim() || '',
        EMAIL_UPDATE: document.getElementById('editEmail')?.value.trim() || '',
        UPDATE_ADDRESS: document.getElementById('editAddress')?.value.toUpperCase().trim() || '',
        NUM_DATE: document.getElementById('editNumDate')?.value.trim() || '',
        ALPHA_DATE: document.getElementById('editAlphaDate')?.value.trim() || '',
        WITNESS_NAME1: document.getElementById('editWitness1Name')?.value.toUpperCase().trim() || '',
        WITNESS_PHONE1: document.getElementById('editWitness1Phone')?.value.trim() || '',
        WITNESS_ADDRESS1: document.getElementById('editWitness1Address')?.value.toUpperCase().trim() || '',
        WITNESS_NAME2: document.getElementById('editWitness2Name')?.value.toUpperCase().trim() || '',
        WITNESS_PHONE2: document.getElementById('editWitness2Phone')?.value.trim() || '',
        WITNESS_ADDRESS2: document.getElementById('editWitness2Address')?.value.toUpperCase().trim() || ''
    };

    const hasSpouseCheck = document.getElementById('editHasSpouse');
    const spouseName1El = document.getElementById('editSpouseName1');

    if (hasSpouseCheck?.checked && spouseName1El?.value.trim()) {
        replacements.WIFE_OF = ' W/o ';
        replacements.SPOUSE_NAME1 = spouseName1El.value.toUpperCase().trim();
    } else {
        replacements.WIFE_OF = '';
        replacements.SPOUSE_NAME1 = '';
    }

    if (doc.template_type === 'minor_template') {
        // Guardian/Parent fields
        replacements['FATHER-MOTHER_NAME'] =
            document.getElementById('editFatherMother')?.value.toUpperCase().trim() || '';
        replacements['FATHER-SPOUSE_NAME'] =
            document.getElementById('editFatherSpouse')?.value.toUpperCase().trim() || '';

        // Handle D/o & W/o for minor
        const minorRelation = document.getElementById('editRelation')?.value || '';
        replacements.UPDATE_RELATION = minorRelation;

        if (minorRelation === 'D/o & W/o') {
            replacements.GUARDIAN_FATHER_NAME =
                document.getElementById('editGuardianFather')?.value.toUpperCase().trim() || '';
            replacements.GUARDIAN_SPOUSE_NAME =
                document.getElementById('editGuardianSpouse')?.value.toUpperCase().trim() || '';
            replacements['FATHER-SPOUSE_NAME'] = '';
        }

        // Child fields
        replacements['SON-DAUGHTER'] =
            (document.getElementById('editSonDaughter')?.value || '').toLowerCase().trim();
        replacements.UPDATE_AGE =
            document.getElementById('editAge')?.value || '';
        replacements.CHILD_DOB =
            document.getElementById('editChildDob')?.value || '';
        replacements.BIRTH_PLACE =
            document.getElementById('editBirthPlace')?.value.toUpperCase().trim() || '';
        replacements.CAST_UPDATE =
            document.getElementById('editCast')?.value.toUpperCase().trim() || '';

        // HE_SHE based on son/daughter
        const sd = replacements['SON-DAUGHTER'];
        replacements.HE_SHE = sd === 'son' ? 'he' : sd === 'daughter' ? 'she' : 'he/she';

    } else {
        // Major & Religion
        const g = (replacements.GENDER_UPDATE || '').toUpperCase();
        replacements.HE_SHE = g === 'MALE' ? 'he' : g === 'FEMALE' ? 'she' : 'he/she';
    }

    const folderTypeEl = document.getElementById('editFolderType');
    const folderType = folderTypeEl ? folderTypeEl.value : 'main';

    try {
        const response = await fetch(`/api/admin/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replacements, folder_type: folderType })
        });

        const data = await response.json();

        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;

        if (data.success) {
            showToast('Success', 'Document saved successfully!', 'success');

            const docIndex = allDocuments.findIndex(d => d.id === docId);
            if (docIndex !== -1) {
                allDocuments[docIndex].replacements = replacements;
                allDocuments[docIndex].old_name = replacements.OLD_NAME;
            }

            loadCDPreview(docId, 'editCdContent');
            await reloadDocsKeepFilters();
            loadAdminStats();

        } else {
            showToast('Error', data.message || 'Failed to save', 'error');
        }
    } catch (error) {
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        showToast('Error', 'Network error', 'error');
    }
}

// ==================== PRINT PREVIEW ====================

async function showPrintPreview(docId) {
    try {
        showToast('Info', 'Generating PDF... please wait.', 'info');
        const url = `/api/admin/documents/${docId}/print-pdf`;
        const printWindow = window.open(url, '_blank');

        if (!printWindow) {
            showToast('Warning', 'Popup blocked. Opening in same tab...', 'warning');
            window.location.href = url;
            return;
        }

        showToast('Success', 'PDF ready! Use Ctrl+P (or ⌘P) to print.', 'success');
    } catch (error) {
        showToast('Error', 'Failed to generate print PDF', 'error');
    }
}

async function downloadPrintPdf(docId) {
    try {
        showToast('Info', 'Preparing PDF download...', 'info');

        const response = await fetch(`/api/admin/documents/${docId}/print-pdf`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'document.pdf';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Success', 'PDF downloaded', 'success');
        } else {
            const data = await response.json().catch(() => ({}));
            showToast('Error', data.message || 'PDF generation failed', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error during PDF download', 'error');
    }
}

function printDocuments() {
    window.print();
}

// ==================== DOWNLOAD ALL FILES ====================

async function downloadAllFiles(docId) {
    try {
        showToast('Info', 'Preparing download...', 'info');

        const response = await fetch(`/api/admin/documents/${docId}/download-all`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'documents.zip';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Success', 'Download started', 'success');
        } else {
            const data = await response.json();
            showToast('Error', data.message || 'Download failed', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error during download', 'error');
    }
}

// ==================== DOWNLOAD CD ONLY ====================

async function downloadCDOnly(docId) {
    try {
        showToast('Info', 'Preparing CD download...', 'info');

        const response = await fetch(`/api/admin/documents/${docId}/download-cd`);

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'CD.docx';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showToast('Success', 'CD document downloaded', 'success');
        } else {
            const data = await response.json();
            showToast('Error', data.message || 'Download failed', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error during download', 'error');
    }
}

// ==================== TOGGLE PUBLISH ====================

async function togglePublish(docId) {
    try {
        const response = await fetch(`/api/admin/documents/${docId}/toggle-publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            const docIndex = allDocuments.findIndex(d => d.id === docId);
            if (docIndex !== -1) {
                allDocuments[docIndex].published = data.published;
                allDocuments[docIndex].published_at = data.published_at;
            }

            renderDocuments(allDocuments);

            if (typeof applyDocFilters === 'function') {
                applyDocFilters();
            }

            showToast('Success', data.message, 'success');
        } else {
            showToast('Error', data.message || 'Failed to toggle publish status', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

// ==================== DELETE DOCUMENT ====================

async function deleteDocument(docId) {
    const doc = allDocuments.find(d => d.id === docId);
    const docName = doc ? doc.old_name : 'this document';

    if (!confirm(`Are you sure you want to delete "${docName}"? This cannot be undone.`)) return;

    try {
        const response = await fetch(`/api/admin/documents/${docId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Success', data.message || 'Document deleted', 'success');
            await reloadDocsKeepFilters();
            loadAdminStats();
        } else {
            showToast('Error', data.message || 'Failed to delete', 'error');
        }
    } catch (error) {
        showToast('Error', 'Network error', 'error');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST' })
        .then(() => { window.location.href = '/'; })
        .catch(() => { window.location.href = '/'; });
}

// ==================== PRINT JOB TRACKER ====================

const activePrintJobs = {};
let _fetchAbortController = null;

async function startPrintPDF(docId) {
    const printBtn = document.getElementById(`print-btn-${docId}`);
    const cancelBtn = document.getElementById(`cancel-print-btn-${docId}`);
    const spinner = document.getElementById(`print-spinner-${docId}`);

    if (printBtn) printBtn.classList.add('d-none');
    if (cancelBtn) { cancelBtn.classList.remove('d-none'); cancelBtn.disabled = false; }
    if (spinner) spinner.classList.remove('d-none');

    _fetchAbortController = new AbortController();

    try {
        const response = await fetch(`/api/admin/documents/${docId}/print-pdf`, {
            method: 'GET',
            headers: { 'Accept': 'application/pdf, application/json' },
            signal: _fetchAbortController.signal
        });

        const jobId = response.headers.get('X-Print-Job-Id');
        if (jobId) activePrintJobs[docId] = jobId;

        const contentType = response.headers.get('Content-Type') || '';

        if (!response.ok || contentType.includes('application/json')) {
            const data = await response.json().catch(() => ({}));
            if (data.cancelled) {
                showToast('Warning', 'Print cancelled.', 'warning');
            } else {
                showToast('Error', data.message || 'Print failed.', 'error');
            }
            return;
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        showToast('Success', 'PDF ready! Opening in new tab.', 'success');

    } catch (err) {
        if (err.name === 'AbortError') {
            showToast('Warning', 'Print cancelled.', 'warning');
        } else {
            showToast('Error', `Error: ${err.message}`, 'error');
        }
    } finally {
        if (printBtn) printBtn.classList.remove('d-none');
        if (cancelBtn) cancelBtn.classList.add('d-none');
        if (spinner) spinner.classList.add('d-none');
        delete activePrintJobs[docId];
        _fetchAbortController = null;
    }
}

async function cancelPrintPDF(docId) {
    const cancelBtn = document.getElementById(`cancel-print-btn-${docId}`);
    if (cancelBtn) {
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cancelling...';
    }

    const jobId = activePrintJobs[docId];

    if (_fetchAbortController) _fetchAbortController.abort();

    if (jobId) {
        try {
            const response = await fetch(`/api/admin/documents/${docId}/cancel-print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId })
            });
            const data = await response.json();
            if (data.success) {
                showToast('Warning', 'Print job cancelled successfully.', 'warning');
            } else {
                showToast('Error', data.message || 'Could not cancel print job.', 'error');
            }
        } catch (err) {
            showToast('Warning', 'Print cancelled.', 'warning');
        }
    } else {
        showToast('Warning', 'Print cancelled.', 'warning');
    }
}

function getPrintActionHTML(docId) {
    return `
        <div class="d-inline-flex align-items-center gap-1" id="print-action-container-${docId}">
            <button class="btn btn-sm btn-outline-success" id="print-btn-${docId}"
                    onclick="showPrintProgress('${docId}')" title="Print PDF">
                <i class="bi bi-printer"></i>
            </button>
            <button class="btn btn-sm btn-danger d-none" id="cancel-print-btn-${docId}"
                    onclick="cancelPrintFromTable('${docId}')" title="Cancel Print">
                <i class="bi bi-x-lg"></i>
            </button>
            <span class="spinner-border spinner-border-sm text-primary d-none"
                  id="print-spinner-${docId}" role="status"></span>
        </div>
    `;
}

async function cancelPrintFromTable(docId) {
    const jobId = activePrintJobs[docId];
    if (!jobId) {
        showToast('Warning', 'No active print job found.', 'warning');
        return;
    }

    try {
        const resp = await fetch(`/api/admin/documents/${docId}/cancel-print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId })
        });
        const data = await resp.json();
        if (data.success) {
            showToast('Warning', 'Print cancelled.', 'warning');
        } else {
            showToast('Error', data.message || 'Could not cancel.', 'error');
        }
    } catch (err) {
        showToast('Warning', 'Print cancelled.', 'warning');
    }
}

// ==================== TABLE SORT ====================

// Tracks sort state for each table
const adminTableSort = {
    overview: { field: null, dir: 'asc' },
    adminUsers: { field: null, dir: 'asc' },
    adminDocs: { field: null, dir: 'asc' }
};

// Keeps a reference to the raw overview users array
// so we can re-sort without re-fetching
let allOverviewUsers = [];

/**
 * Called when any sort header button is clicked.
 * Toggles direction if same column, resets to asc if new column.
 */
function setAdminTableSort(table, field) {
    const state = adminTableSort[table];
    if (!state) return;

    if (state.field === field) {
        // Same column → toggle direction
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
        // New column → ascending by default
        state.field = field;
        state.dir = 'asc';
    }

    // Update all arrow indicators
    updateAdminSortIndicators();

    // Re-render the affected table
    if (table === 'overview') renderUserActivity(allOverviewUsers);
    if (table === 'adminUsers') renderUsers(allUsers);
    if (table === 'adminDocs') renderDocuments(allDocuments);
}

/**
 * Extracts a comparable value from a data item for a given field.
 * Date fields return a numeric timestamp (null-safe).
 */
function getAdminSortValue(item, field) {
    const dateFields = ['last_login', 'created_at', 'modified_at'];

    if (dateFields.includes(field)) {
        const v = item[field];
        if (!v) return null;
        const t = new Date(v).getTime();
        return isNaN(t) ? null : t;
    }

    const v = item[field];
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;
    return String(v).toLowerCase().trim();
}

/**
 * Returns a new sorted copy of list using the current sort state for `table`.
 * Nulls always sort to the bottom regardless of direction.
 */
function sortAdminData(list, table) {
    const state = adminTableSort[table];

    // No sort active → return original order
    if (!state || !state.field) return [...list];

    return [...list].sort((a, b) => {
        const av = getAdminSortValue(a, state.field);
        const bv = getAdminSortValue(b, state.field);

        // Nulls always last
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;

        if (av < bv) return state.dir === 'asc' ? -1 : 1;
        if (av > bv) return state.dir === 'asc' ? 1 : -1;
        return 0;
    });
}

/**
 * Refreshes the ↕ / ↑ / ↓ arrows on every sort button.
 * Active column gets a coloured arrow; others reset to ↕.
 */
function updateAdminSortIndicators() {
    document.querySelectorAll('.table-sort-btn').forEach(btn => {
        const table = btn.dataset.table;
        const field = btn.dataset.field;
        const arrow = btn.querySelector('.sort-arrow');
        const state = adminTableSort[table];

        btn.classList.remove('active');
        if (!arrow) return;

        if (state && state.field === field) {
            btn.classList.add('active');
            arrow.textContent = state.dir === 'asc' ? '↑' : '↓';
        } else {
            arrow.textContent = '↕';
        }
    });
}


// ==================== ALIAS HELPERS (ADMIN EDIT) ====================

/**
 * Parses "NAME alias ALIAS1 alias ALIAS2" into { baseName, aliases[] }
 */
function parseOldNameWithAliases(oldName) {
    if (!oldName) return { baseName: '', aliases: [] };
    const parts = oldName.split(/\s+alias\s+/i);
    return {
        baseName: parts[0].trim(),
        aliases: parts.slice(1).map(a => a.trim()).filter(Boolean)
    };
}

/**
 * Builds "NAME alias ALIAS1 alias ALIAS2" from baseName + aliases[]
 */
function buildAdminOldNameWithAliases() {
    const baseInput = document.getElementById('editOldName');
    const container = document.getElementById('editAliasContainer');
    if (!baseInput) return '';

    const baseName = baseInput.value.trim().toUpperCase();
    if (!container) return baseName;

    const aliasInputs = container.querySelectorAll('.edit-alias-input');
    const aliases = [];
    aliasInputs.forEach(function (inp) {
        const v = inp.value.trim().toUpperCase();
        if (v) aliases.push(v);
    });

    if (aliases.length === 0) return baseName;
    return baseName + ' alias ' + aliases.join(' alias ');
}

let editAliasCounter = 0;

/**
 * Adds a new alias field in the edit modal
 */
function addEditAliasField(existingValue) {
    editAliasCounter++;
    const container = document.getElementById('editAliasContainer');
    if (!container) return;

    const n = editAliasCounter;
    const wrapper = document.createElement('div');
    wrapper.className = 'alias-field-wrapper';
    wrapper.id = 'edit_alias_item_' + n;
    wrapper.style.cssText = 'display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; animation: slideDown 0.3s ease;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control edit-alias-input';
    input.placeholder = 'Alias ' + n;
    input.value = existingValue ? existingValue.toUpperCase() : '';
    input.style.textTransform = 'uppercase';
    input.setAttribute('oninput', 'this.value=this.value.toUpperCase(); updateEditAliasPreview();');

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.title = 'Remove Alias';
    deleteBtn.style.cssText = `
        background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
        border: none;
        color: white;
        padding: 0;
        border-radius: 8px;
        width: 38px;
        height: 38px;
        min-width: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex-shrink: 0;
    `;
    deleteBtn.innerHTML = '<i class="bi bi-trash3"></i>';
    deleteBtn.setAttribute('onclick', 'removeEditAliasField(' + n + ')');

    wrapper.appendChild(input);
    wrapper.appendChild(deleteBtn);
    container.appendChild(wrapper);

    updateEditAliasCounter();
    updateEditAliasPreview();

    if (!existingValue) input.focus();
}

/**
 * Removes an alias field by index
 */
function removeEditAliasField(n) {
    const el = document.getElementById('edit_alias_item_' + n);
    if (el) {
        el.remove();
        updateEditAliasCounter();
        updateEditAliasPreview();
    }
}

/**
 * Updates the alias count badge
 */
function updateEditAliasCounter() {
    const container = document.getElementById('editAliasContainer');
    const counter = document.getElementById('editAliasCounter');
    if (!container || !counter) return;

    const count = container.querySelectorAll('.alias-field-wrapper').length;
    if (count > 0) {
        counter.style.display = 'inline-block';
        const span = counter.querySelector('.count');
        if (span) span.textContent = count;
    } else {
        counter.style.display = 'none';
    }
}

/**
 * Updates the alias preview text
 */
function updateEditAliasPreview() {
    const baseInput = document.getElementById('editOldName');
    const container = document.getElementById('editAliasContainer');
    const preview = document.getElementById('editAliasPreview');
    const previewText = document.getElementById('editAliasPreviewText');

    if (!baseInput || !container || !preview || !previewText) return;

    const baseName = baseInput.value.trim().toUpperCase();
    const aliasInputs = container.querySelectorAll('.edit-alias-input');

    let html = '<span style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:0.25rem 0.5rem;border-radius:6px;display:inline-block;margin:0.25rem;font-weight:600;">'
        + (escapeHtml(baseName) || 'NAME') + '</span>';

    let hasAlias = false;
    aliasInputs.forEach(function (inp) {
        const v = inp.value.trim().toUpperCase();
        if (v) {
            hasAlias = true;
            html += '<span style="color:var(--primary-gray);font-style:italic;font-weight:500;margin:0 0.25rem;">alias</span>'
                + '<span style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:0.25rem 0.5rem;border-radius:6px;display:inline-block;margin:0.25rem;font-weight:600;">'
                + escapeHtml(v) + '</span>';
        }
    });

    if (baseName || hasAlias) {
        preview.style.display = 'block';
        previewText.innerHTML = html;
    } else {
        preview.style.display = 'none';
    }
}
