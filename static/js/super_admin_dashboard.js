// ==================== GLOBAL VARIABLES ====================
let allAdmins = [];
let allUsers = [];
let allDocuments = [];
let currentDocFilter = 'all';
let currentEditAdminId = null;
let currentEditUserId = null;

// Modal instances
let addUserModal = null;
let editAdminModal = null;
let editUserModal = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
    editAdminModal = new bootstrap.Modal(document.getElementById('editAdminModal'));
    editUserModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    
    loadStats();
    loadAdmins();
    loadUsers();
    loadDocuments();
    
    updateDateTime();
    setInterval(updateDateTime, 60000);
    
    // Tab change handlers
    document.querySelectorAll('#superAdminTabs button').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function(e) {
            const targetId = e.target.getAttribute('data-bs-target');
            if (targetId === '#admins') loadAdmins();
            else if (targetId === '#users') loadUsers();
            else if (targetId === '#documents') loadDocuments();
            else if (targetId === '#overview') loadStats();
        });
    });
});

// ==================== DATE/TIME ====================
function updateDateTime() {
    const now = new Date();
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}

// ==================== LOAD STATS ====================
async function loadStats() {
    try {
        const response = await fetch('/api/superadmin/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalSuperAdmins').textContent = data.overall.super_admins || 1;
            document.getElementById('totalAdmins').textContent = data.overall.total_admins;
            document.getElementById('totalUsers').textContent = data.overall.total_users;
            document.getElementById('totalDocuments').textContent = data.overall.total_documents;
            document.getElementById('pendingDocs').textContent = data.overall.pending;
            document.getElementById('generatedDocs').textContent = data.overall.generated;
            
            renderAdminActivity(data.admins);
            renderUserActivity(data.users);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function renderAdminActivity(admins) {
    const tbody = document.getElementById('adminActivityBody');
    if (!tbody) return;
    
    if (!admins || admins.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No admins</td></tr>';
        return;
    }
    
    let html = '';
    admins.slice(0, 5).forEach(admin => {
        const lastLogin = admin.last_login ? formatDate(new Date(admin.last_login)) : 'Never';
        const status = admin.is_active 
            ? '<span class="badge bg-success">Active</span>' 
            : '<span class="badge bg-danger">Inactive</span>';
        
        html += `
            <tr>
                <td>${escapeHtml(admin.name)}</td>
                <td>${status}</td>
                <td><small>${lastLogin}</small></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderUserActivity(users) {
    const tbody = document.getElementById('userActivityBody');
    if (!tbody) return;
    
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No users</td></tr>';
        return;
    }
    
    // Sort by total docs
    const sorted = users.sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0));
    
    let html = '';
    sorted.slice(0, 5).forEach(user => {
        html += `
            <tr>
                <td>${escapeHtml(user.name)}</td>
                <td><span class="badge bg-info">${user.stats?.total || 0}</span></td>
                <td><span class="badge bg-success">${user.stats?.generated || 0}</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==================== LOAD ADMINS ====================
async function loadAdmins() {
    try {
        const response = await fetch('/api/superadmin/admins');
        const data = await response.json();
        
        if (data.success) {
            allAdmins = data.admins;
            renderAdmins();
        }
    } catch (error) {
        console.error('Error loading admins:', error);
    }
}

function renderAdmins() {
    const tbody = document.getElementById('adminsTableBody');
    const emptyState = document.getElementById('adminsEmptyState');
    const table = document.getElementById('adminsTable');
    
    if (!tbody) return;
    
    if (allAdmins.length === 0) {
        tbody.innerHTML = '';
        if (table) table.classList.add('d-none');
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }
    
    if (table) table.classList.remove('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    
    let html = '';
    allAdmins.forEach(admin => {
        const created = admin.created_at ? formatDate(new Date(admin.created_at)) : 'N/A';
        const lastLogin = admin.last_login ? formatDate(new Date(admin.last_login)) : 'Never';
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="me-2" style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">
                            ${admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="fw-semibold">${escapeHtml(admin.name)}</div>
                    </div>
                </td>
                <td>${escapeHtml(admin.email)}</td>
                <td>${escapeHtml(admin.phone || '-')}</td>
                <td>
                    <span class="badge ${admin.is_active ? 'bg-success' : 'bg-danger'}">
                        ${admin.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td><small class="text-muted">${created}</small></td>
                <td><small class="text-muted">${lastLogin}</small></td>
                <td class="action-buttons-cell">
                    <button class="btn btn-sm btn-edit" onclick="openEditAdmin('${admin.id}')" title="Edit">
                        <i class="bi bi-pencil me-1"></i>Edit
                    </button>
                    <button class="btn btn-sm btn-outline-${admin.is_active ? 'warning' : 'success'}" 
                            onclick="toggleAdmin('${admin.id}')" title="${admin.is_active ? 'Deactivate' : 'Activate'}">
                        <i class="bi bi-${admin.is_active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteAdmin('${admin.id}', '${escapeHtml(admin.name)}')" title="Delete">
                        <i class="bi bi-trash me-1"></i>Delete
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function openEditAdmin(adminId) {
    const admin = allAdmins.find(a => a.id === adminId);
    if (!admin) return;
    
    currentEditAdminId = adminId;
    document.getElementById('editAdminId').value = adminId;
    document.getElementById('editAdminName').value = admin.name;
    document.getElementById('editAdminEmail').value = admin.email;
    document.getElementById('editAdminPhone').value = admin.phone || '';
    document.getElementById('editAdminPassword').value = '';
    
    editAdminModal.show();
}

async function updateAdmin() {
    if (!currentEditAdminId) return;
    
    const payload = {
        name: document.getElementById('editAdminName').value.trim(),
        email: document.getElementById('editAdminEmail').value.trim(),
        phone: document.getElementById('editAdminPhone').value.trim()
    };
    
    const password = document.getElementById('editAdminPassword').value;
    if (password) payload.password = password;
    
    try {
        const response = await fetch(`/api/superadmin/admins/${currentEditAdminId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Success', 'Admin updated successfully');
            editAdminModal.hide();
            loadAdmins();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to update admin');
    }
}

async function toggleAdmin(adminId) {
    try {
        const response = await fetch(`/api/superadmin/admins/${adminId}/toggle`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Success', data.message);
            loadAdmins();
            loadStats();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to toggle admin status');
    }
}

async function deleteAdmin(adminId, adminName) {
    if (!confirm(`Are you sure you want to delete admin "${adminName}"?`)) return;
    
    try {
        const response = await fetch(`/api/superadmin/admins/${adminId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Deleted', 'Admin deleted successfully');
            loadAdmins();
            loadStats();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to delete admin');
    }
}

// ==================== LOAD USERS ====================
async function loadUsers() {
    try {
        const response = await fetch('/api/superadmin/users');
        const data = await response.json();
        
        if (data.success) {
            allUsers = data.users;
            renderUsers();
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('usersEmptyState');
    const table = document.getElementById('usersTable');
    
    if (!tbody) return;
    
    if (allUsers.length === 0) {
        tbody.innerHTML = '';
        if (table) table.classList.add('d-none');
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }
    
    if (table) table.classList.remove('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    
    let html = '';
    allUsers.forEach(user => {
        const lastLogin = user.last_login ? formatDate(new Date(user.last_login)) : 'Never';
        
        html += `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="me-2" style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="fw-semibold">${escapeHtml(user.name)}</div>
                    </div>
                </td>
                <td>${escapeHtml(user.email)}</td>
                <td>${escapeHtml(user.phone || '-')}</td>
                <td><span class="badge bg-info">-</span></td>
                <td>
                    <span class="badge ${user.is_active ? 'bg-success' : 'bg-danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td><small class="text-muted">${lastLogin}</small></td>
                <td class="action-buttons-cell">
                    <button class="btn btn-sm btn-edit" onclick="openEditUser('${user.id}')" title="Edit">
                        <i class="bi bi-pencil me-1"></i>Edit
                    </button>
                    <button class="btn btn-sm btn-outline-${user.is_active ? 'warning' : 'success'}" 
                            onclick="toggleUser('${user.id}')" title="${user.is_active ? 'Deactivate' : 'Activate'}">
                        <i class="bi bi-${user.is_active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteUser('${user.id}', '${escapeHtml(user.name)}')" title="Delete">
                        <i class="bi bi-trash me-1"></i>Delete
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('newUserPassword').value = 'Ayraservices@123';
    addUserModal.show();
}

async function createUser() {
    const payload = {
        name: document.getElementById('newUserName').value.trim(),
        email: document.getElementById('newUserEmail').value.trim(),
        phone: document.getElementById('newUserPhone').value.trim(),
        password: document.getElementById('newUserPassword').value
    };
    
    if (!payload.name || !payload.email) {
        showToast('warning', 'Warning', 'Name and email are required');
        return;
    }
    
    try {
        const response = await fetch('/api/superadmin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Success', 'User created successfully');
            addUserModal.hide();
            loadUsers();
            loadStats();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to create user');
    }
}

function openEditUser(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    currentEditUserId = userId;
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserName').value = user.name;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserPassword').value = '';
    
    editUserModal.show();
}

async function updateUser() {
    if (!currentEditUserId) return;
    
    const payload = {
        name: document.getElementById('editUserName').value.trim(),
        email: document.getElementById('editUserEmail').value.trim(),
        phone: document.getElementById('editUserPhone').value.trim()
    };
    
    const password = document.getElementById('editUserPassword').value;
    if (password) payload.password = password;
    
    try {
        const response = await fetch(`/api/superadmin/users/${currentEditUserId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Success', 'User updated successfully');
            editUserModal.hide();
            loadUsers();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to update user');
    }
}

async function toggleUser(userId) {
    try {
        const response = await fetch(`/api/superadmin/users/${userId}/toggle`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Success', data.message);
            loadUsers();
            loadStats();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to toggle user status');
    }
}

async function deleteUser(userId, userName) {
    if (!confirm(`Are you sure you want to delete user "${userName}"?`)) return;
    
    try {
        const response = await fetch(`/api/superadmin/users/${userId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            showToast('success', 'Deleted', 'User deleted successfully');
            loadUsers();
            loadStats();
        } else {
            showToast('error', 'Error', data.message);
        }
    } catch (error) {
        showToast('error', 'Error', 'Failed to delete user');
    }
}

// ==================== LOAD DOCUMENTS ====================
async function loadDocuments() {
    try {
        const response = await fetch('/api/superadmin/documents');
        const data = await response.json();
        
        if (data.success) {
            allDocuments = data.documents;
            renderDocuments();
        }
    } catch (error) {
        console.error('Error loading documents:', error);
    }
}

function filterDocs(status) {
    currentDocFilter = status;
    document.querySelectorAll('#documents .btn-group .btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderDocuments();
}

function renderDocuments() {
    const tbody = document.getElementById('docsTableBody');
    const emptyState = document.getElementById('docsEmptyState');
    const table = document.getElementById('docsTable');
    
    if (!tbody) return;
    
    let filtered = allDocuments;
    if (currentDocFilter !== 'all') {
        filtered = allDocuments.filter(d => d.status === currentDocFilter);
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (table) table.classList.add('d-none');
        if (emptyState) emptyState.classList.remove('d-none');
        return;
    }
    
    if (table) table.classList.remove('d-none');
    if (emptyState) emptyState.classList.add('d-none');
    
    let html = '';
    filtered.forEach(doc => {
        const modified = doc.modified_at ? formatDate(new Date(doc.modified_at)) : 'N/A';
        
        html += `
            <tr>
                <td>${escapeHtml(doc.user_name || 'Unknown')}</td>
                <td><strong>${escapeHtml(doc.old_name || 'Unnamed')}</strong></td>
                <td><span class="badge bg-secondary">${escapeHtml(doc.template_name || doc.template_type)}</span></td>
                <td><span class="status-badge ${doc.status}">${doc.status.toUpperCase()}</span></td>
                <td><small class="text-muted">${modified}</small></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ==================== UTILITIES ====================
function formatDate(date) {
    return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastBody = document.getElementById('toastBody');
    
    if (!toast) return;
    
    const iconMap = {
        'success': 'bi-check-circle-fill text-success',
        'warning': 'bi-exclamation-triangle-fill text-warning',
        'info': 'bi-info-circle-fill text-info',
        'error': 'bi-exclamation-triangle-fill text-danger'
    };
    
    toastIcon.className = 'bi me-2 ' + (iconMap[type] || iconMap['info']);
    toastTitle.textContent = title;
    toastBody.textContent = message;
    
    new bootstrap.Toast(toast).show();
}

async function logout() {
    try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        const data = await response.json();
        if (data.success) window.location.href = data.redirect || '/';
    } catch (error) {
        window.location.href = '/';
    }
}