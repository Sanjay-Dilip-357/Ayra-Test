// ==================== GLOBAL VARIABLES ====================
let allAdmins = [];
let allUsers = [];
let allDocuments = [];
let currentDocFilter = 'all';
let currentEditAdminId = null;
let currentEditUserId = null;

let addUserModal = null;
let editAdminModal = null;
let editUserModal = null;

// ==================== DB CONSOLE ====================
const dbQueryHistory = [];
let dbLastResult = null;

const dbEsc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
);

function dbEl(id) { return document.getElementById(id); }

// ── Chip state ──
function dbSetChip(state, data) {
    const chip = dbEl('dbStatusChip');
    const rows = dbEl('dbRowCountChip');
    const time = dbEl('dbTimeChip');
    if (!chip) return;

    chip.className = 'meta-chip';
    switch (state) {
        case 'running':
            chip.classList.add('running');
            chip.textContent = 'running…';
            if (rows) rows.textContent = '— rows';
            if (time) time.textContent = '— ms';
            break;
        case 'ok':
            chip.classList.add('ok');
            chip.textContent = '✓ success';
            if (data && rows) rows.textContent = `${data.row_count ?? 0} rows`;
            if (data && time) time.textContent = `${data.elapsed_ms ?? 0} ms`;
            break;
        case 'err':
            chip.classList.add('err');
            chip.textContent = '✗ error';
            if (rows) rows.textContent = '— rows';
            if (data && time) time.textContent = `${data.elapsed_ms ?? 0} ms`;
            break;
        default:
            chip.textContent = 'idle';
    }
}

// ── Cell rendering with smart type detection ──
function dbCellHtml(v, colName) {
    if (v === null || v === undefined)
        return '<td class="cell-null">NULL</td>';

    if (typeof v === 'boolean')
        return `<td class="${v ? 'cell-bool-true' : 'cell-bool-false'}">${v}</td>`;

    if (typeof v === 'number')
        return `<td class="cell-number">${v.toLocaleString()}</td>`;

    if (typeof v === 'object')
        return `<td><span class="cell-json" title="${dbEsc(JSON.stringify(v, null, 2))}">${dbEsc(JSON.stringify(v))}</span></td>`;

    const s = String(v);

    // Password hash — mask it
    if (colName && /password|hash/i.test(colName) && s.length > 20)
        return `<td class="cell-password" title="Hidden for security">••••••••••</td>`;

    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
        const d = new Date(s);
        if (!isNaN(d)) {
            const fmt = d.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            return `<td class="cell-datetime" title="${dbEsc(s)}">${dbEsc(fmt)}</td>`;
        }
    }

    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
        return `<td class="cell-uuid" title="${dbEsc(s)}">${dbEsc(s.slice(0, 8))}…</td>`;

    // Long text
    if (s.length > 120)
        return `<td class="cell-long-string" title="${dbEsc(s)}">${dbEsc(s.slice(0, 100))}…</td>`;

    // Boolean-like strings
    if (s === 'true' || s === 'True')
        return '<td class="cell-bool-true">true</td>';
    if (s === 'false' || s === 'False')
        return '<td class="cell-bool-false">false</td>';

    return `<td class="cell-string">${dbEsc(s)}</td>`;
}

// ── Render: empty ──
function dbRenderEmpty() {
    const body = dbEl('dbResultsBody');
    if (!body) return;
    body.innerHTML = `
        <div class="db-results-empty">
            <i class="bi bi-inbox"></i>
            <div>Query returned 0 rows.</div>
        </div>`;
    dbSetChip('ok', { row_count: 0, elapsed_ms: 0 });
    dbLastResult = null;
    const exp = dbEl('dbExportBtn');
    if (exp) exp.disabled = true;
}

// ── Render: error ──
function dbRenderError(message, elapsed) {
    const body = dbEl('dbResultsBody');
    if (!body) return;
    body.innerHTML = `
        <div class="db-results-message error">
            <i class="bi bi-x-circle-fill"></i>
            <div>${dbEsc(message)}</div>
        </div>`;
    dbSetChip('err', { elapsed_ms: elapsed ?? 0 });
    dbLastResult = null;
    const exp = dbEl('dbExportBtn');
    if (exp) exp.disabled = true;
}

// ── Render: success message (non-SELECT) ──
function dbRenderMessage(message, data) {
    const body = dbEl('dbResultsBody');
    if (!body) return;
    body.innerHTML = `
        <div class="db-results-message success">
            <i class="bi bi-check-circle-fill"></i>
            <div>${dbEsc(message)}</div>
        </div>`;
    dbSetChip('ok', data);
    dbLastResult = null;
    const exp = dbEl('dbExportBtn');
    if (exp) exp.disabled = true;
}

// ── Render: rows table ──
function dbRenderRows(data) {
    const body = dbEl('dbResultsBody');
    const exp = dbEl('dbExportBtn');
    if (!body) return;

    if (!data.rows || data.rows.length === 0) return dbRenderEmpty();

    const cols = data.columns;

    const headCells = cols.map(c =>
        `<th>${dbEsc(c)}</th>`
    ).join('');

    const bodyRows = data.rows.map((row, idx) => {
        const cells = row.map((val, ci) => dbCellHtml(val, cols[ci])).join('');
        return `<tr><td class="row-num">${idx + 1}</td>${cells}</tr>`;
    }).join('');

    body.innerHTML = `
        <table class="db-results-table">
            <thead>
                <tr>
                    <th class="row-num-header">#</th>
                    ${headCells}
                </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
        </table>
        <div class="db-results-footer">
            <span>Showing ${data.rows.length} of ${data.row_count} rows</span>
            <span>${data.elapsed_ms} ms</span>
        </div>`;

    dbSetChip('ok', data);
    dbLastResult = data;
    if (exp) exp.disabled = false;
}

// ── Render dispatcher ──
function dbRenderResult(data) {
    if (!data.ok) return dbRenderError(data.error, data.elapsed_ms);
    if (data.kind === 'status') return dbRenderMessage(data.message, data);
    if (data.kind === 'rows') return dbRenderRows(data);
}

// ── History ──
function dbPushHistory(sql, ok) {
    const now = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    dbQueryHistory.unshift({ sql, ok, time: now });
    if (dbQueryHistory.length > 50) dbQueryHistory.pop();
    dbRefreshHistory();
}

function dbRefreshHistory() {
    const list = dbEl('dbHistoryList');
    if (!list) return;

    if (dbQueryHistory.length === 0) {
        list.innerHTML = '<div class="db-history-empty">No queries yet in this session.</div>';
        return;
    }

    list.innerHTML = dbQueryHistory.map((h, i) => `
        <div class="db-history-item" data-idx="${i}">
            <span class="history-status-dot ${h.ok ? 'ok' : 'err'}"></span>
            <span class="history-query" title="${dbEsc(h.sql)}">${dbEsc(h.sql)}</span>
            <span class="history-time">${dbEsc(h.time)}</span>
        </div>`
    ).join('');

    list.querySelectorAll('.db-history-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = +el.dataset.idx;
            const input = dbEl('dbQueryInput');
            if (input && dbQueryHistory[idx]) {
                input.value = dbQueryHistory[idx].sql;
                input.focus();
            }
        });
    });
}

// ── Format SQL ──
function dbFormatSQL(sql) {
    const kws = [
        'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
        'INNER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING',
        'LIMIT', 'OFFSET', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET',
        'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE',
        'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'AS',
        'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DISTINCT',
        'UNION', 'EXCEPT', 'INTERSECT', 'WITH', 'IS NULL', 'IS NOT NULL'
    ];
    let f = sql.trim();
    kws.forEach(kw => {
        f = f.replace(new RegExp(`\\b${kw}\\b`, 'gi'), kw);
    });
    ['FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
        'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'ON', 'AND', 'OR'
    ].forEach(c => {
        f = f.replace(new RegExp(`\\s+${c}\\b`, 'g'), `\n${c}`);
    });
    return f.trim();
}

// ── Export CSV ──
function dbExportCSV() {
    if (!dbLastResult) return;
    const { columns, rows } = dbLastResult;
    const esc = v => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
            ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        columns.map(esc).join(','),
        ...rows.map(r => r.map(esc).join(','))
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `db_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Run query ──
async function dbRunQuery() {
    const input = dbEl('dbQueryInput');
    const runBtn = dbEl('dbRunBtn');
    if (!input) return;

    const sql = input.value.trim();
    if (!sql) return;

    const mode = dbEl('dbModeSelect')?.value || 'read';
    const limit = +(dbEl('dbLimitSelect')?.value || 100);

    if (mode === 'write' &&
        !confirm('⚠️ WRITE mode — this will modify the live database.\n\nAre you sure?')) {
        return;
    }

    dbSetChip('running');
    if (runBtn) runBtn.disabled = true;

    try {
        const res = await fetch('/api/super-admin/db/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, mode, limit })
        });

        // Guard against non-JSON (redirect / 404)
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            throw new Error(`Server returned ${res.status} (expected JSON). Check if the DB console route is registered.`);
        }

        const data = await res.json();
        dbRenderResult(data);
        dbPushHistory(sql, data.ok);
    } catch (err) {
        dbRenderError(err.message);
        dbPushHistory(sql, false);
    } finally {
        if (runBtn) runBtn.disabled = false;
    }
}

// ── Load meta ──
async function dbLoadMeta() {
    try {
        const res = await fetch('/api/super-admin/db/meta');
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
            console.warn('DB meta endpoint not available');
            const eng = dbEl('dbEngineName');
            if (eng) eng.textContent = 'unavailable';
            return;
        }
        const data = await res.json();
        if (!data.ok) return;

        const eng = dbEl('dbEngineName');
        if (eng) eng.textContent = data.engine === 'postgresql' ? 'PostgreSQL' : data.engine.toUpperCase();

        data.tables.forEach(t => {
            const rc = document.getElementById(`rc-${t.name.replace(/_/g, '-')}`);
            if (rc) rc.textContent = t.rows.toLocaleString();
        });
    } catch (err) {
        console.warn('DB meta load failed:', err);
        const eng = dbEl('dbEngineName');
        if (eng) eng.textContent = 'error';
    }
}

// ── Init DB console ──
function dbInitConsole() {
    const input = dbEl('dbQueryInput');
    if (!input) return;

    // Ctrl/Cmd + Enter
    input.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            dbRunQuery();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const s = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.substring(0, s) + '  ' + input.value.substring(end);
            input.selectionStart = input.selectionEnd = s + 2;
        }
    });

    dbEl('dbRunBtn')?.addEventListener('click', dbRunQuery);

    dbEl('dbFormatBtn')?.addEventListener('click', () => {
        if (input.value.trim()) input.value = dbFormatSQL(input.value);
    });

    dbEl('dbClearBtn')?.addEventListener('click', () => {
        input.value = '';
        input.focus();
    });

    dbEl('dbExportBtn')?.addEventListener('click', dbExportCSV);

    dbEl('dbHistoryClearBtn')?.addEventListener('click', () => {
        dbQueryHistory.length = 0;
        dbRefreshHistory();
    });

    // Sidebar clicks — clean up multiline data-query attributes
    document.querySelectorAll('[data-query]').forEach(el => {
        el.addEventListener('click', () => {
            input.value = el.dataset.query.replace(/\s+/g, ' ').trim();
            dbRunQuery();
        });
    });

    // Load meta when tab is shown
    const dbTab = dbEl('dbconsole-tab');
    if (dbTab) {
        dbTab.addEventListener('shown.bs.tab', () => dbLoadMeta());
    }
}


// ==================== TABLE SORT ====================
const tableSort = {
    admins: { field: null, dir: 'asc' },
    users: { field: null, dir: 'asc' },
    docs: { field: null, dir: 'asc' }
};

function setTableSort(table, field) {
    const current = tableSort[table];
    if (!current) return;

    if (current.field === field) {
        current.dir = current.dir === 'asc' ? 'desc' : 'asc';
    } else {
        current.field = field;
        current.dir = 'asc';
    }

    updateSortIndicators();

    if (table === 'admins') renderAdmins();
    else if (table === 'users') renderUsers();
    else if (table === 'docs') renderDocuments();
}

function getSortableValue(table, item, field) {
    let value = null;
    let type = 'string';

    if (table === 'admins') {
        if (field === 'status') {
            value = item.is_active ? 1 : 0;
            type = 'number';
        } else if (field === 'created_at' || field === 'last_login') {
            value = item[field];
            type = 'date';
        } else {
            value = item[field];
        }
    } else if (table === 'users') {
        if (field === 'last_login') {
            value = item.last_login;
            type = 'date';
        } else {
            value = item[field];
        }
    } else if (table === 'docs') {
        if (field === 'modified_at') {
            value = item.modified_at;
            type = 'date';
        } else {
            value = item[field];
        }
    }

    return { value, type };
}

function normalizeSortValue(value, type) {
    if (value === null || value === undefined || value === '') return null;

    if (type === 'number') return Number(value);

    if (type === 'date') {
        const t = new Date(value).getTime();
        return isNaN(t) ? null : t;
    }

    return String(value).toLowerCase().trim();
}

function compareSortValues(a, b, dir) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;

    if (a < b) return dir === 'asc' ? -1 : 1;
    if (a > b) return dir === 'asc' ? 1 : -1;
    return 0;
}

function getSortedData(list, table) {
    const state = tableSort[table];
    if (!state || !state.field) return [...list];

    return [...list].sort((a, b) => {
        const aMeta = getSortableValue(table, a, state.field);
        const bMeta = getSortableValue(table, b, state.field);

        const av = normalizeSortValue(aMeta.value, aMeta.type);
        const bv = normalizeSortValue(bMeta.value, bMeta.type);

        return compareSortValues(av, bv, state.dir);
    });
}

function updateSortIndicators() {
    document.querySelectorAll('.table-sort-btn').forEach(btn => {
        const table = btn.dataset.table;
        const field = btn.dataset.field;
        const arrow = btn.querySelector('.sort-arrow');
        const state = tableSort[table];

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

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function () {
    addUserModal = new bootstrap.Modal(document.getElementById('addUserModal'));
    editAdminModal = new bootstrap.Modal(document.getElementById('editAdminModal'));
    editUserModal = new bootstrap.Modal(document.getElementById('editUserModal'));

    loadStats();
    loadAdmins();
    loadUsers();
    loadDocuments();

    updateSortIndicators();

    updateDateTime();
    setInterval(updateDateTime, 60000);

    document.querySelectorAll('#superAdminTabs button').forEach(tab => {
        tab.addEventListener('shown.bs.tab', function (e) {
            const t = e.target.getAttribute('data-bs-target');
            if (t === '#admins') loadAdmins();
            else if (t === '#users') loadUsers();
            else if (t === '#documents') loadDocuments();
            else if (t === '#overview') loadStats();
        });
    });

    dbInitConsole();
    initSortBars();
});


// ==================== DATE/TIME ====================
function updateDateTime() {
    const el = document.getElementById('currentDateTime');
    if (el) {
        el.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}


// ==================== LOAD STATS ====================
async function loadStats() {
    try {
        const r = await fetch('/api/superadmin/stats');
        const d = await r.json();
        if (d.success) {
            document.getElementById('totalSuperAdmins').textContent = d.overall.super_admins || 1;
            document.getElementById('totalAdmins').textContent = d.overall.total_admins;
            document.getElementById('totalUsers').textContent = d.overall.total_users;
            document.getElementById('totalDocuments').textContent = d.overall.total_documents;
            document.getElementById('pendingDocs').textContent = d.overall.pending;
            document.getElementById('generatedDocs').textContent = d.overall.generated;
            renderAdminActivity(d.admins);
            renderUserActivity(d.users);
        }
    } catch (e) { console.error('Stats error:', e); }
}

function renderAdminActivity(admins) {
    const tbody = document.getElementById('adminActivityBody');
    if (!tbody) return;
    if (!admins || !admins.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No admins</td></tr>';
        return;
    }
    tbody.innerHTML = admins.slice(0, 5).map(a => {
        const ll = a.last_login ? formatDate(new Date(a.last_login)) : 'Never';
        const st = a.is_active
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-danger">Inactive</span>';
        return `<tr><td>${escapeHtml(a.name)}</td><td>${st}</td><td><small>${ll}</small></td></tr>`;
    }).join('');
}

function renderUserActivity(users) {
    const tbody = document.getElementById('userActivityBody');
    if (!tbody) return;
    if (!users || !users.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No users</td></tr>';
        return;
    }
    const sorted = [...users].sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0));
    tbody.innerHTML = sorted.slice(0, 5).map(u =>
        `<tr><td>${escapeHtml(u.name)}</td>
         <td><span class="badge bg-info">${u.stats?.total || 0}</span></td>
         <td><span class="badge bg-success">${u.stats?.generated || 0}</span></td></tr>`
    ).join('');
}


// ==================== ADMINS ====================
async function loadAdmins() {
    try {
        const r = await fetch('/api/superadmin/admins');
        const d = await r.json();
        if (d.success) { allAdmins = d.admins; renderAdmins(); }
    } catch (e) { console.error('Admins error:', e); }
}

function renderAdmins() {
    const tbody = document.getElementById('adminsTableBody');
    const empty = document.getElementById('adminsEmptyState');
    const table = document.getElementById('adminsTable');
    const admins = getSortedData(allAdmins, 'admins');
    if (!tbody) return;
    if (!allAdmins.length) {
        tbody.innerHTML = '';
        table?.classList.add('d-none');
        empty?.classList.remove('d-none');
        return;
    }
    table?.classList.remove('d-none');
    empty?.classList.add('d-none');
    tbody.innerHTML = admins.map(a => {
        const cr = a.created_at ? formatDate(new Date(a.created_at)) : 'N/A';
        const ll = a.last_login ? formatDate(new Date(a.last_login)) : 'Never';
        return `<tr>
            <td><div class="d-flex align-items-center gap-2">
                <div class="user-avatar-sm">${a.name.charAt(0).toUpperCase()}</div>
                <span class="fw-semibold">${escapeHtml(a.name)}</span>
            </div></td>
            <td>${escapeHtml(a.email)}</td>
            <td>${escapeHtml(a.phone || '—')}</td>
            <td><span class="badge ${a.is_active ? 'bg-success' : 'bg-danger'}">${a.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><small class="text-muted">${cr}</small></td>
            <td><small class="text-muted">${ll}</small></td>
            <td class="action-buttons-cell">
                <button class="btn btn-sm btn-edit" onclick="openEditAdmin('${a.id}')"><i class="bi bi-pencil me-1"></i>Edit</button>
                <button class="btn btn-sm btn-outline-${a.is_active ? 'warning' : 'success'}" onclick="toggleAdmin('${a.id}')"><i class="bi bi-${a.is_active ? 'pause' : 'play'}"></i></button>
                <button class="btn btn-sm btn-delete" onclick="deleteAdmin('${a.id}','${escapeHtml(a.name)}')"><i class="bi bi-trash me-1"></i>Delete</button>
            </td></tr>`;
    }).join('');
}

function openEditAdmin(id) {
    const a = allAdmins.find(x => x.id === id);
    if (!a) return;
    currentEditAdminId = id;
    document.getElementById('editAdminId').value = id;
    document.getElementById('editAdminName').value = a.name;
    document.getElementById('editAdminEmail').value = a.email;
    document.getElementById('editAdminPhone').value = a.phone || '';
    document.getElementById('editAdminPassword').value = '';
    editAdminModal.show();
}

async function updateAdmin() {
    if (!currentEditAdminId) return;
    const p = {
        name: document.getElementById('editAdminName').value.trim(),
        email: document.getElementById('editAdminEmail').value.trim(),
        phone: document.getElementById('editAdminPhone').value.trim()
    };
    const pw = document.getElementById('editAdminPassword').value;
    if (pw) p.password = pw;
    try {
        const r = await fetch(`/api/superadmin/admins/${currentEditAdminId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
        });
        const d = await r.json();
        if (d.success) { showToast('success', 'Success', 'Admin updated'); editAdminModal.hide(); loadAdmins(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to update admin'); }
}

async function toggleAdmin(id) {
    try {
        const r = await fetch(`/api/superadmin/admins/${id}/toggle`, { method: 'POST' });
        const d = await r.json();
        if (d.success) { showToast('success', 'Success', d.message); loadAdmins(); loadStats(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to toggle admin'); }
}

async function deleteAdmin(id, name) {
    if (!confirm(`Delete admin "${name}"?`)) return;
    try {
        const r = await fetch(`/api/superadmin/admins/${id}`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { showToast('success', 'Deleted', 'Admin deleted'); loadAdmins(); loadStats(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to delete admin'); }
}


// ==================== USERS ====================
async function loadUsers() {
    try {
        const r = await fetch('/api/superadmin/users');
        const d = await r.json();
        if (d.success) { allUsers = d.users; renderUsers(); }
    } catch (e) { console.error('Users error:', e); }
}

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    const empty = document.getElementById('usersEmptyState');
    const table = document.getElementById('usersTable');
    const users = getSortedData(allUsers, 'users');
    if (!tbody) return;
    if (!allUsers.length) {
        tbody.innerHTML = '';
        table?.classList.add('d-none');
        empty?.classList.remove('d-none');
        return;
    }
    table?.classList.remove('d-none');
    empty?.classList.add('d-none');
    tbody.innerHTML = users.map(u => {
        const ll = u.last_login ? formatDate(new Date(u.last_login)) : 'Never';
        return `<tr>
            <td><div class="d-flex align-items-center gap-2">
                <div class="user-avatar-sm user-avatar-green">${u.name.charAt(0).toUpperCase()}</div>
                <span class="fw-semibold">${escapeHtml(u.name)}</span>
            </div></td>
            <td>${escapeHtml(u.email)}</td>
            <td>${escapeHtml(u.phone || '—')}</td>
            <td><span class="badge bg-info">—</span></td>
            <td><span class="badge ${u.is_active ? 'bg-success' : 'bg-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><small class="text-muted">${ll}</small></td>
            <td class="action-buttons-cell">
                <button class="btn btn-sm btn-edit" onclick="openEditUser('${u.id}')"><i class="bi bi-pencil me-1"></i>Edit</button>
                <button class="btn btn-sm btn-outline-${u.is_active ? 'warning' : 'success'}" onclick="toggleUser('${u.id}')"><i class="bi bi-${u.is_active ? 'pause' : 'play'}"></i></button>
                <button class="btn btn-sm btn-delete" onclick="deleteUser('${u.id}','${escapeHtml(u.name)}')"><i class="bi bi-trash me-1"></i>Delete</button>
            </td></tr>`;
    }).join('');
}

function showAddUserModal() {
    document.getElementById('addUserForm').reset();
    document.getElementById('newUserPassword').value = 'Ayraservices@123';
    addUserModal.show();
}

async function createUser() {
    const p = {
        name: document.getElementById('newUserName').value.trim(),
        email: document.getElementById('newUserEmail').value.trim(),
        phone: document.getElementById('newUserPhone').value.trim(),
        password: document.getElementById('newUserPassword').value
    };
    if (!p.name || !p.email) { showToast('warning', 'Warning', 'Name and email required'); return; }
    try {
        const r = await fetch('/api/superadmin/users', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
        });
        const d = await r.json();
        if (d.success) { showToast('success', 'Success', 'User created'); addUserModal.hide(); loadUsers(); loadStats(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to create user'); }
}

function openEditUser(id) {
    const u = allUsers.find(x => x.id === id);
    if (!u) return;
    currentEditUserId = id;
    document.getElementById('editUserId').value = id;
    document.getElementById('editUserName').value = u.name;
    document.getElementById('editUserEmail').value = u.email;
    document.getElementById('editUserPhone').value = u.phone || '';
    document.getElementById('editUserPassword').value = '';
    editUserModal.show();
}

async function updateUser() {
    if (!currentEditUserId) return;
    const p = {
        name: document.getElementById('editUserName').value.trim(),
        email: document.getElementById('editUserEmail').value.trim(),
        phone: document.getElementById('editUserPhone').value.trim()
    };
    const pw = document.getElementById('editUserPassword').value;
    if (pw) p.password = pw;
    try {
        const r = await fetch(`/api/superadmin/users/${currentEditUserId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p)
        });
        const d = await r.json();
        if (d.success) { showToast('success', 'Success', 'User updated'); editUserModal.hide(); loadUsers(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to update user'); }
}

async function toggleUser(id) {
    try {
        const r = await fetch(`/api/superadmin/users/${id}/toggle`, { method: 'POST' });
        const d = await r.json();
        if (d.success) { showToast('success', 'Success', d.message); loadUsers(); loadStats(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to toggle user'); }
}

async function deleteUser(id, name) {
    if (!confirm(`Delete user "${name}"?`)) return;
    try {
        const r = await fetch(`/api/superadmin/users/${id}`, { method: 'DELETE' });
        const d = await r.json();
        if (d.success) { showToast('success', 'Deleted', 'User deleted'); loadUsers(); loadStats(); }
        else showToast('error', 'Error', d.message);
    } catch { showToast('error', 'Error', 'Failed to delete user'); }
}


// ==================== DOCUMENTS ====================
async function loadDocuments() {
    try {
        const r = await fetch('/api/superadmin/documents');
        const d = await r.json();
        if (d.success) { allDocuments = d.documents; renderDocuments(); }
    } catch (e) { console.error('Docs error:', e); }
}

function filterDocs(status) {
    currentDocFilter = status;
    document.querySelectorAll('[data-testid^="filter-"]').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
    });
    const map = { all: 'filter-all', draft: 'filter-draft', pending: 'filter-pending', approved: 'filter-approved', generated: 'filter-generated' };
    const btn = document.querySelector(`[data-testid="${map[status]}"]`);
    if (btn) { btn.classList.remove('btn-secondary'); btn.classList.add('btn-primary'); }
    renderDocuments();
}

function renderDocuments() {
    const tbody = document.getElementById('docsTableBody');
    const empty = document.getElementById('docsEmptyState');
    const table = document.getElementById('docsTable');
    if (!tbody) return;
    let filtered = currentDocFilter === 'all' ? allDocuments : allDocuments.filter(d => d.status === currentDocFilter); filtered = getSortedData(filtered, 'docs');
    if (!filtered.length) {
        tbody.innerHTML = '';
        table?.classList.add('d-none');
        empty?.classList.remove('d-none');
        return;
    }
    table?.classList.remove('d-none');
    empty?.classList.add('d-none');
    tbody.innerHTML = filtered.map(doc => {
        const mod = doc.modified_at ? formatDate(new Date(doc.modified_at)) : 'N/A';
        return `<tr>
            <td>${escapeHtml(doc.user_name || 'Unknown')}</td>
            <td><strong>${escapeHtml(doc.old_name || 'Unnamed')}</strong></td>
            <td><span class="badge bg-secondary">${escapeHtml(doc.template_name || doc.template_type)}</span></td>
            <td><span class="status-badge ${doc.status}">${doc.status.toUpperCase()}</span></td>
            <td><small class="text-muted">${mod}</small></td></tr>`;
    }).join('');
}


// ==================== UTILITIES ====================
function formatDate(date) {
    if (!date || isNaN(date)) return 'Invalid';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function showToast(type, title, message) {
    const t = document.getElementById('toast');
    if (!t) return;
    const icons = {
        success: 'bi-check-circle-fill text-success',
        warning: 'bi-exclamation-triangle-fill text-warning',
        info: 'bi-info-circle-fill text-info',
        error: 'bi-exclamation-triangle-fill text-danger'
    };
    document.getElementById('toastIcon').className = 'bi me-2 ' + (icons[type] || icons.info);
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastBody').textContent = message;
    new bootstrap.Toast(t).show();
}

async function logout() {
    try {
        const r = await fetch('/api/auth/logout', { method: 'POST' });
        const d = await r.json();
        if (d.success) window.location.href = d.redirect || '/';
    } catch { window.location.href = '/'; }
}

// ==================== SORT BAR ====================
/*
 * Unified sort state for each table.
 * col  = column index (matches <td> position in rendered rows)
 * dir  = 'asc' | 'desc'
 */
const sortState = {
    admins: { col: 0, dir: 'asc' },
    users: { col: 0, dir: 'asc' },
    docs: { col: 0, dir: 'asc' }
};

/**
 * Returns the raw sortable value from a rendered <tr> at a given column index.
 * Strips HTML, handles dates and numbers.
 */
function getSortValue(row, colIndex) {
    const cells = row.querySelectorAll('td');
    // +1 offset: first <td> is the avatar/name wrapper; we index from 0 matching data cols
    const cell = cells[colIndex];
    if (!cell) return '';

    // Prefer data-sort attribute if present (set manually for dates etc.)
    if (cell.dataset.sort) return cell.dataset.sort;

    // Strip HTML tags → plain text
    const text = cell.innerText.trim();

    // Numeric
    const num = parseFloat(text.replace(/,/g, ''));
    if (!isNaN(num) && text !== '') return num;

    // "Never" → sort to end
    if (text === 'Never') return '9999-99-99';

    // Date strings — try to parse
    const d = new Date(text);
    if (!isNaN(d)) return d.toISOString();

    return text.toLowerCase();
}

/**
 * Sorts any tbody by column index and direction.
 */
function sortTableBody(tbody, colIndex, dir) {
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length < 2) return;

    rows.sort((a, b) => {
        const va = getSortValue(a, colIndex);
        const vb = getSortValue(b, colIndex);
        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    // Re-append in sorted order
    rows.forEach(r => tbody.appendChild(r));
}

/**
 * Updates button visual state (active + direction arrow).
 */
function updateSortButtons(tableKey, activeCol, dir) {
    document.querySelectorAll(`.sort-btn[data-table="${tableKey}"]`).forEach(btn => {
        const col = +btn.dataset.col;
        const dirSpan = btn.querySelector('.sort-dir');

        if (col === activeCol) {
            btn.classList.add('active');
            const arrow = dir === 'asc' ? '↑' : '↓';
            if (dirSpan) {
                dirSpan.textContent = arrow;
            } else {
                btn.insertAdjacentHTML('beforeend',
                    `<span class="sort-dir">${arrow}</span>`);
            }
        } else {
            btn.classList.remove('active');
            if (dirSpan) dirSpan.remove();
        }
    });
}

/**
 * Called when a sort button is clicked.
 * Toggles direction if already active; else switches column.
 */
function handleSortClick(tableKey, colIndex) {
    const state = sortState[tableKey];

    if (state.col === colIndex) {
        // Toggle direction
        state.dir = state.dir === 'asc' ? 'desc' : 'asc';
    } else {
        state.col = colIndex;
        state.dir = 'asc';
    }

    const tbodyId = {
        admins: 'adminsTableBody',
        users: 'usersTableBody',
        docs: 'docsTableBody'
    }[tableKey];

    sortTableBody(document.getElementById(tbodyId), state.col, state.dir);
    updateSortButtons(tableKey, state.col, state.dir);
}

/**
 * Wire up all sort buttons once DOM is ready.
 * Called from DOMContentLoaded — add this line there.
 */
function initSortBars() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            handleSortClick(btn.dataset.table, +btn.dataset.col);
        });
    });
}
