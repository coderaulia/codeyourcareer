/* js/admin.js - Admin Panel Features */

function switchAdminTab(btn, tabName) {
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    btn.classList.add('active');
}

async function initAdmin() {
    refreshDashboard();
    loadSiteSettingsAdmin();
    refreshAdminLinks();
    refreshResources();
    refreshBookings();
    refreshModulesAdmin();
}

/* ========== Dashboard Overview ========== */
async function refreshDashboard() {
    // 1. Fetch Links count
    sb.from('links').select('id', { count: 'exact' }).then(({ count }) => {
        const el = document.getElementById('stat-links');
        if (el) el.textContent = count !== null ? count : 0;
    });

    // 2. Fetch New Bookings
    sb.from('bookings').select('id', { count: 'exact' }).eq('status', 'pending').then(({ count }) => {
        const el = document.getElementById('stat-bookings');
        if (el) el.textContent = count !== null ? count : 0;
    });

    // 3. Fetch Unread Messages
    sb.from('contact_messages').select('id', { count: 'exact' }).eq('is_read', false).then(({ count }) => {
        const el = document.getElementById('stat-messages');
        if (el) el.textContent = count !== null ? count : 0;
    });

    // 4. Fetch Tracked Clicks
    sb.from('link_clicks').select('id', { count: 'exact' }).then(({ count }) => {
        const el = document.getElementById('stat-clicks');
        if (el) el.textContent = count !== null ? count : 0;
    });
}

/* ========== Site Settings ========== */
async function loadSiteSettingsAdmin() {
    try {
        const { data } = await sb.from('site_settings').select('*').eq('id', 1).single();
        if (!data) return;
        const v = (id, val) => { const e = document.getElementById(id); if (e) e.value = val || ''; };
        v('set-site-name', data.site_name); v('set-headline', data.headline);
        v('set-subheadline', data.subheadline); v('set-footer', data.footer_text);
        v('set-cta-title', data.cta_title); v('set-cta-subtitle', data.cta_subtitle);
        v('set-cta-button', data.cta_button_text);
        v('set-logo-type', data.logo_type); v('set-logo-svg', data.logo_svg);
        v('set-logo-image', data.logo_image_url); v('set-logo-emoji', data.logo_emoji);
        v('set-bg-color', data.bg_color); v('set-text-color', data.text_color);
        v('set-text-sec', data.text_secondary); v('set-accent', data.accent_color);
        v('set-card-bg', data.card_bg); v('set-card-border', data.card_border);
        v('set-cta-bg', data.cta_bg); v('set-cta-text', data.cta_text);
        v('set-cta-btn-bg', data.cta_btn_bg); v('set-cta-btn-text', data.cta_btn_text);
        toggleLogoFields();
    } catch (e) { }
}

async function saveSiteSettings() {
    const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    const payload = {
        site_name: g('set-site-name'), headline: g('set-headline'),
        subheadline: g('set-subheadline'), footer_text: g('set-footer'),
        cta_title: g('set-cta-title'), cta_subtitle: g('set-cta-subtitle'),
        cta_button_text: g('set-cta-button'),
        logo_type: g('set-logo-type'), logo_svg: g('set-logo-svg'),
        logo_image_url: g('set-logo-image'), logo_emoji: g('set-logo-emoji'),
        bg_color: g('set-bg-color'), text_color: g('set-text-color'),
        text_secondary: g('set-text-sec'), accent_color: g('set-accent'),
        card_bg: g('set-card-bg'), card_border: g('set-card-border'),
        cta_bg: g('set-cta-bg'), cta_text: g('set-cta-text'),
        cta_btn_bg: g('set-cta-btn-bg'), cta_btn_text: g('set-cta-btn-text')
    };
    try {
        const { error } = await sb.from('site_settings').update(payload).eq('id', 1);
        if (error) throw error;
        alert('Settings saved!');
    } catch (e) { alert('Failed: ' + e.message); }
}

function toggleLogoFields() {
    const t = document.getElementById('set-logo-type');
    if (!t) return;
    const v = t.value;
    ['logo-svg-field', 'logo-image-field', 'logo-emoji-field'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    const m = { svg: 'logo-svg-field', image: 'logo-image-field', emoji: 'logo-emoji-field' };
    if (m[v]) { const e = document.getElementById(m[v]); if (e) e.style.display = ''; }
}

/* ========== Modules ========== */
async function refreshModulesAdmin() {
    const c = document.getElementById('module-list'); if (!c) return;
    try {
        const { data } = await sb.from('modules').select('*').order('display_order');
        if (!data) return;
        c.innerHTML = data.map(m => `
            <div class="module-toggle-card ${m.is_enabled ? 'enabled' : ''}">
                <div><i class="bi ${m.icon} me-2"></i><strong>${escapeHtml(m.name)}</strong><div class="text-muted small">${escapeHtml(m.description || '')}</div></div>
                <label class="toggle-switch"><input type="checkbox" ${m.is_enabled ? 'checked' : ''} onchange="toggleModule('${m.slug}',this.checked)"><span class="toggle-slider"></span></label>
            </div>`).join('');

        // Populate Dashboard Active Modules
        const dashboardMod = document.getElementById('dashboard-active-modules');
        if (dashboardMod) {
            const activeMods = data.filter(m => m.is_enabled);
            dashboardMod.innerHTML = activeMods.length > 0
                ? activeMods.map(m => `<div class="d-flex align-items-center small border p-2 rounded bg-light"><i class="bi ${m.icon} me-2 text-primary"></i> <span class="fw-bold">${escapeHtml(m.name)}</span></div>`).join('')
                : '<div class="text-muted small">No active modules.</div>';
        }

        // Show/hide module-specific panels
        data.forEach(m => {
            const panel = document.getElementById('mod-' + m.slug);
            if (panel) panel.style.display = m.is_enabled ? '' : 'none';
        });
        // Load data
        if (data.find(m => m.slug === 'testimonials' && m.is_enabled)) refreshTestimonials();
        if (data.find(m => m.slug === 'contact' && m.is_enabled)) refreshMessages();
        if (data.find(m => m.slug === 'analytics' && m.is_enabled)) loadAnalytics();
    } catch (e) { }
}

async function toggleModule(slug, enabled) {
    try {
        const { error } = await sb.from('modules').update({ is_enabled: enabled }).eq('slug', slug);
        if (error) throw error;
        refreshModulesAdmin();
    } catch (e) { alert('Failed: ' + e.message); }
}

/* ========== Links ========== */
async function refreshAdminLinks() {
    const el = document.getElementById('list-links'); if (!el) return;
    el.innerHTML = '<small class="text-muted">Loading...</small>';
    try {
        const { data, error } = await sb.from('links').select('*').order('display_order');
        if (error) throw error;
        el.innerHTML = data && data.length ? data.map(l => {
            const badge = l.is_active ? '<span class="badge bg-success" style="font-size:0.6rem">ON</span>' : '<span class="badge bg-secondary" style="font-size:0.6rem">OFF</span>';
            const icon = l.link_type === 'external' ? '🔗' : '📁';
            return `<div class="d-flex justify-content-between align-items-center border-bottom py-2 small"><div>${icon} <strong>${escapeHtml(l.title)}</strong> ${badge}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(l.url)}</div></div><div><button class="btn btn-link p-0 me-2" onclick='editLink(${JSON.stringify(l).replace(/'/g, "&#39;")})'>Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteLink('${l.id}')">Del</button></div></div>`;
        }).join('') : '<small class="text-muted">No links.</small>';
    } catch (e) { el.innerHTML = '<small class="text-danger">Error</small>'; }
}

async function saveLink(e) {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Saving...';
    const id = document.getElementById('link-id').value;
    const p = {
        title: document.getElementById('link-title').value, url: document.getElementById('link-url').value,
        icon: document.getElementById('link-icon').value || 'bi-link-45deg', link_type: document.getElementById('link-type').value,
        internal_target: document.getElementById('link-internal-target').value || null, style_bg: document.getElementById('link-style-bg').value || null,
        display_order: parseInt(document.getElementById('link-order').value) || 0, is_active: document.getElementById('link-active').checked
    };
    try {
        const { error } = id ? await sb.from('links').update(p).eq('id', id) : await sb.from('links').insert([p]);
        if (error) throw error;
        resetLinkForm(); e.target.reset(); refreshAdminLinks();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { btn.disabled = false; btn.innerText = 'Save Link'; }
}

function editLink(d) {
    document.getElementById('link-id').value = d.id; document.getElementById('link-title').value = d.title;
    document.getElementById('link-url').value = d.url; document.getElementById('link-icon').value = d.icon || '';
    document.getElementById('link-type').value = d.link_type || 'external';
    document.getElementById('link-internal-target').value = d.internal_target || '';
    document.getElementById('link-style-bg').value = d.style_bg || '';
    document.getElementById('link-order').value = d.display_order || 0;
    document.getElementById('link-active').checked = d.is_active;
    toggleInternalFields(); document.getElementById('link-title').focus();
}
async function deleteLink(id) { if (confirm('Delete?')) { await sb.from('links').delete().eq('id', id); refreshAdminLinks(); } }
function resetLinkForm() { document.getElementById('link-id').value = ''; document.getElementById('link-active').checked = true; }
function toggleInternalFields() { const f = document.getElementById('internal-fields'); if (f) f.style.display = document.getElementById('link-type').value === 'internal' ? '' : 'none'; }

/* ========== Resources ========== */
async function refreshResources() {
    for (let table of ['freebies', 'gear']) {
        const el = document.getElementById('list-' + table); if (!el) continue;
        el.innerHTML = '<small class="text-muted">Loading...</small>';
        try {
            const { data } = await sb.from(table).select('*').order('display_order');
            el.innerHTML = data && data.length ? data.map(r => `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${escapeHtml(r.title)}</span><div><button class="btn btn-link p-0 me-2" onclick="editItem('${table}',${JSON.stringify(r).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteItem('${table}','${r.id}')">Del</button></div></div>`).join('') : '<small class="text-muted">Empty</small>';
        } catch (e) { el.innerHTML = '<small class="text-danger">Error</small>'; }
    }
}

async function saveResource(e) {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = 'Saving...';
    const table = document.getElementById('form-sheet').value.toLowerCase();
    const id = document.getElementById('form-id').value;
    const p = { title: document.getElementById('form-title').value, link: document.getElementById('form-link').value };
    if (table === 'freebies') p.description = document.getElementById('form-extra').value; else p.category = document.getElementById('form-extra').value;
    try {
        const { error } = id ? await sb.from(table).update(p).eq('id', id) : await sb.from(table).insert([p]);
        if (error) throw error;
        document.getElementById('form-id').value = ''; e.target.reset(); refreshResources();
    } catch (err) { alert('Failed: ' + err.message); }
    finally { btn.disabled = false; btn.innerText = 'Save to Database'; }
}

function editItem(table, d) {
    document.getElementById('form-sheet').value = table.charAt(0).toUpperCase() + table.slice(1);
    document.getElementById('form-id').value = d.id; document.getElementById('form-title').value = d.title;
    document.getElementById('form-link').value = d.link; document.getElementById('form-extra').value = d.description || d.category || '';
}
async function deleteItem(table, id) { if (confirm('Delete?')) { await sb.from(table).delete().eq('id', id); refreshResources(); refreshBookings(); } }

/* ========== Bookings ========== */
async function refreshBookings() {
    const el = document.getElementById('list-bookings'); if (!el) return;
    el.innerHTML = '<small class="text-muted">Loading...</small>';
    try {
        const { data } = await sb.from('bookings').select('*').order('created_at', { ascending: false });
        if (!data || !data.length) { el.innerHTML = '<small class="text-muted">No bookings.</small>'; return; }
        el.innerHTML = data.map(r => {
            const confirmed = r.meetlink && r.meetlink !== '';
            const act = confirmed ? `<a href="${escapeHtml(r.meetlink)}" target="_blank" class="btn btn-sm btn-success fw-bold" style="font-size:0.7rem"><i class="bi bi-camera-video"></i> Meet</a>` : `<button class="btn btn-sm btn-outline-dark" style="font-size:0.7rem" onclick="confirmBooking('${r.id}','${escapeHtml(r.name)}','${escapeHtml(r.email)}','${escapeHtml(r.topic)}','${r.schedule}')"><i class="bi bi-check-lg"></i> Confirm</button>`;
            return `<div class="border-bottom py-2 small"><div class="d-flex justify-content-between align-items-center"><div><strong>${escapeHtml(r.name)}</strong> <span class="badge bg-light text-dark border">${escapeHtml(r.topic)}</span><div class="text-muted">${formatDate(r.schedule)} · ${escapeHtml(r.email)}</div></div><div class="d-flex flex-column gap-1 text-end">${act}<button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteItem('bookings','${r.id}')">Del</button></div></div></div>`;
        }).join('');
    } catch (e) { el.innerHTML = '<small class="text-danger">Error</small>'; }
}

async function confirmBooking(id, name, email, topic, schedule) {
    const link = prompt('Enter Meet link for ' + name + ':', 'https://meet.google.com/');
    if (!link) return;
    try { await sb.from('bookings').update({ meetlink: link, status: 'confirmed' }).eq('id', id); alert('Confirmed!'); refreshBookings(); } catch (e) { alert('Failed'); }
}

/* ========== Testimonials ========== */
async function refreshTestimonials() {
    const el = document.getElementById('list-testimonials'); if (!el) return;
    try {
        const { data } = await sb.from('testimonials').select('*').order('display_order');
        el.innerHTML = data && data.length ? data.map(t => `<div class="d-flex justify-content-between border-bottom py-2 small"><div><strong>${escapeHtml(t.name)}</strong> ${'★'.repeat(t.rating)}<div class="text-muted">${escapeHtml(t.content).substring(0, 60)}...</div></div><div><button class="btn btn-link p-0 me-2" onclick="editTestimonial(${JSON.stringify(t).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteTestimonial('${t.id}')">Del</button></div></div>`).join('') : '<small class="text-muted">No testimonials.</small>';
    } catch (e) { }
}

async function saveTestimonial(e) {
    e.preventDefault();
    const id = document.getElementById('testi-id').value;
    const p = { name: document.getElementById('testi-name').value, role: document.getElementById('testi-role').value, content: document.getElementById('testi-content').value, rating: parseInt(document.getElementById('testi-rating').value) };
    try {
        const { error } = id ? await sb.from('testimonials').update(p).eq('id', id) : await sb.from('testimonials').insert([p]);
        if (error) throw error;
        document.getElementById('testi-id').value = ''; e.target.reset(); refreshTestimonials();
    } catch (err) { alert('Failed: ' + err.message); }
}

function editTestimonial(d) {
    document.getElementById('testi-id').value = d.id; document.getElementById('testi-name').value = d.name;
    document.getElementById('testi-role').value = d.role || ''; document.getElementById('testi-content').value = d.content;
    document.getElementById('testi-rating').value = d.rating;
}

async function deleteTestimonial(id) {
    if (confirm('Delete?')) { await sb.from('testimonials').delete().eq('id', id); refreshTestimonials(); }
}

/* ========== Contact Messages ========== */
async function refreshMessages() {
    const el = document.getElementById('list-messages'); if (!el) return;
    try {
        const { data } = await sb.from('contact_messages').select('*').order('created_at', { ascending: false });
        el.innerHTML = data && data.length ? data.map(m => `<div class="border-bottom py-2 small ${m.is_read ? '' : 'fw-bold'}"><div class="d-flex justify-content-between"><div><strong>${escapeHtml(m.name)}</strong> <span class="text-muted">${escapeHtml(m.email)}</span><div>${escapeHtml(m.message)}</div><div class="text-muted" style="font-size:0.7rem">${formatDate(m.created_at)}</div></div><div><button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteMessage('${m.id}')">Del</button></div></div></div>`).join('') : '<small class="text-muted">No messages.</small>';
    } catch (e) { }
}

async function deleteMessage(id) {
    if (confirm('Delete?')) { await sb.from('contact_messages').delete().eq('id', id); refreshMessages(); }
}

/* ========== Analytics ========== */
async function loadAnalytics() {
    const el = document.getElementById('analytics-data'); if (!el) return;
    try {
        const { data } = await sb.from('link_clicks').select('link_title, clicked_at').order('clicked_at', { ascending: false }).limit(100);
        if (!data || !data.length) { el.innerHTML = '<small class="text-muted">No click data yet.</small>'; return; }
        // Aggregate by link
        const counts = {};
        data.forEach(d => { const t = d.link_title || 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        el.innerHTML = '<h6 class="fw-bold small mb-2">Top Clicked Links (last 100)</h6>' + sorted.map(([title, count]) => {
            const pct = Math.round(count / data.length * 100);
            return `<div class="mb-2"><div class="d-flex justify-content-between small"><span>${escapeHtml(title)}</span><strong>${count}</strong></div><div class="progress" style="height:6px"><div class="progress-bar bg-dark" style="width:${pct}%"></div></div></div>`;
        }).join('') + `<div class="text-muted small mt-3">Total clicks tracked: ${data.length}</div>`;
    } catch (e) { el.innerHTML = '<small class="text-danger">Error loading analytics.</small>'; }
}
