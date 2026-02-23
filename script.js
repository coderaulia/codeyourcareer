/* script.js — Supabase Backend */

/* --- UTILITIES --- */
function checkAdminSession() {
    if (document.getElementById('dashboard') && localStorage.getItem('cyc_admin_auth') === 'true') {
        document.getElementById('loginGate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        refreshAdmin();
    }
}

function adminLogout() {
    localStorage.removeItem('cyc_admin_auth');
    localStorage.removeItem('cyc_admin_user');
    supabase.auth.signOut();
    location.reload();
}

/* --- NAVIGATION --- */
function navigateTo(id) {
    const current = document.querySelector('.active');
    const next = document.getElementById(id);
    if (id === 'freebies') fetchResources('freebies', 'freebies-list');
    if (id === 'gear') fetchResources('gear', 'gear-list');
    if (current) {
        anime({ targets: current, opacity: 0, translateY: -20, duration: 300, easing: 'easeInQuad', complete: () => { current.classList.remove('active'); current.style.display = 'none'; showView(next); } });
    } else { showView(next); }
}

function showView(el) {
    el.style.display = 'block';
    el.classList.add('active');
    anime({ targets: el, opacity: [0, 1], translateY: [20, 0], duration: 500, easing: 'easeOutExpo' });
}

/* --- PUBLIC: Load Dynamic Links --- */
async function loadLinks() {
    const container = document.getElementById('dynamic-links');
    if (!container) return;

    try {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return;

        // Separate external and internal links
        const externalLinks = data.filter(l => l.link_type === 'external');
        const internalLinks = data.filter(l => l.link_type === 'internal');

        let html = '';

        // Render external links
        externalLinks.forEach(link => {
            html += `
                <a href="${link.url}" target="_blank" class="link-card">
                    <span class="link-icon"><i class="bi ${link.icon}"></i></span>
                    <span class="link-text">${link.title}</span>
                    <i class="bi bi-arrow-right"></i>
                </a>`;
        });

        // Spacer between groups
        if (externalLinks.length > 0 && internalLinks.length > 0) {
            html += '<div class="my-2"></div>';
        }

        // Render internal links
        internalLinks.forEach(link => {
            const bgStyle = link.style_bg ? `background-color: ${link.style_bg};` : '';
            const arrowIcon = link.internal_target === 'freebies' ? 'bi-download' : 'bi-box-arrow-up-right';
            html += `
                <div onclick="navigateTo('${link.internal_target}')" class="link-card" style="${bgStyle}">
                    <span class="link-icon"><i class="bi ${link.icon}"></i></span>
                    <span class="link-text">${link.title}</span>
                    <i class="bi ${arrowIcon}"></i>
                </div>`;
        });

        container.innerHTML = html;
    } catch (err) {
        console.error('Failed to load links:', err);
        // Links will stay as fallback HTML if loading fails
    }
}

/* --- PUBLIC: Fetch Resources --- */
async function fetchResources(table, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="text-muted small text-center py-4">Loading data...</div>`;

    try {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="text-muted small text-center">No items found.</div>';
            return;
        }

        container.innerHTML = data.map(item => `
            <a href="${item.link}" target="_blank" class="link-card">
                <div><div class="fw-bold">${item.title}</div><div class="small text-muted">${item.description || item.category || ''}</div></div>
                <i class="bi bi-box-arrow-up-right"></i>
            </a>`).join('');
    } catch (err) {
        container.innerHTML = `<div class="text-danger small text-center">Failed to load.</div>`;
    }
}

/* --- PUBLIC: Consultation Form --- */
async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const hp = document.getElementById('hp_field').value;
    if (hp !== "") return; // honeypot check

    btn.disabled = true;
    btn.innerText = "Processing...";

    const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        topic: document.getElementById('topic').value,
        schedule: document.getElementById('schedule').value,
    };

    try {
        const { data, error } = await supabase
            .from('bookings')
            .insert([payload]);

        if (error) throw error;

        alert('Success! Session booked.');
        navigateTo('home');
        e.target.reset();
    } catch (err) {
        alert('Error: ' + (err.message || 'Connection Failed.'));
    } finally {
        btn.disabled = false;
        btn.innerText = "Submit Request";
    }
}

/* --- ADMIN: Login --- */
async function adminLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const btn = document.querySelector('#loginGate button');
    btn.disabled = true;

    try {
        // Authenticate using Supabase Auth (email-based)
        // The username is treated as an email for Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: user,
            password: pass
        });

        if (error) throw error;

        localStorage.setItem('cyc_admin_auth', 'true');
        localStorage.setItem('cyc_admin_user', user);
        document.getElementById('loginGate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        refreshAdmin();
    } catch (err) {
        alert('Access Denied: ' + (err.message || 'Invalid credentials'));
    } finally {
        btn.disabled = false;
    }
}

/* --- ADMIN: Refresh Dashboard --- */
async function refreshAdmin() {
    // Refresh Links
    await refreshAdminLinks();

    // Refresh Resources (Freebies & Gear)
    const tables = ['freebies', 'gear'];
    for (let table of tables) {
        const el = document.getElementById(`list-${table}`);
        if (!el) continue;
        el.innerHTML = '<small class="text-muted">Syncing...</small>';

        try {
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;

            const sheetName = table.charAt(0).toUpperCase() + table.slice(1);
            el.innerHTML = data.length > 0
                ? data.map(r => `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${r.title}</span><div><button class="btn btn-link p-0 me-2" onclick="editItem('${table}', ${JSON.stringify(r).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteItem('${table}','${r.id}')">Del</button></div></div>`).join('')
                : `<small class="text-muted">No ${table} found.</small>`;
        } catch (err) {
            el.innerHTML = '<small class="text-danger">Error loading.</small>';
        }
    }

    // Refresh Bookings
    const bookingEl = document.getElementById('list-bookings');
    if (bookingEl) {
        bookingEl.innerHTML = '<small class="text-muted">Syncing...</small>';
        try {
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data.length === 0) {
                bookingEl.innerHTML = '<small class="text-muted">No bookings.</small>';
            } else {
                bookingEl.innerHTML = data.map(r => {
                    const isConfirmed = r.meetlink && r.meetlink !== "";
                    const actionBtn = isConfirmed
                        ? `<a href="${r.meetlink}" target="_blank" class="btn btn-sm btn-success fw-bold" style="font-size:0.75rem;"><i class="bi bi-camera-video"></i> Join Meet</a>`
                        : `<button class="btn btn-sm btn-outline-dark" style="font-size: 0.75rem;" onclick="confirmBooking('${r.id}', '${escapeHtml(r.name)}', '${escapeHtml(r.email)}', '${escapeHtml(r.topic)}', '${r.schedule}')"><i class="bi bi-check-lg"></i> Confirm</button>`;

                    return `
                    <div class="border-bottom py-3 small">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">${escapeHtml(r.name)}</div>
                                <div class="badge bg-light text-dark border mb-1">${escapeHtml(r.topic)}</div>
                                <div class="text-muted">Req: ${formatDate(r.schedule)}</div>
                                <div class="text-muted fst-italic">${escapeHtml(r.email)}</div>
                            </div>
                            <div class="d-flex flex-column gap-2 text-end">
                                ${actionBtn}
                                <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size:0.75rem;" onclick="deleteItem('bookings', '${r.id}')">Delete</button>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        } catch (err) {
            bookingEl.innerHTML = '<small class="text-danger">Error loading bookings.</small>';
        }
    }
}

/* --- ADMIN: Refresh Links List --- */
async function refreshAdminLinks() {
    const el = document.getElementById('list-links');
    if (!el) return;
    el.innerHTML = '<small class="text-muted">Syncing links...</small>';

    try {
        const { data, error } = await supabase
            .from('links')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            el.innerHTML = '<small class="text-muted">No links found.</small>';
            return;
        }

        el.innerHTML = data.map(link => {
            const statusBadge = link.is_active
                ? '<span class="badge bg-success" style="font-size:0.65rem;">Active</span>'
                : '<span class="badge bg-secondary" style="font-size:0.65rem;">Hidden</span>';
            const typeLabel = link.link_type === 'external' ? '🔗' : '📁';

            return `
            <div class="d-flex justify-content-between align-items-center border-bottom py-2 small">
                <div>
                    <span>${typeLabel}</span>
                    <span class="fw-bold">${escapeHtml(link.title)}</span>
                    ${statusBadge}
                    <div class="text-muted" style="font-size:0.7rem;">${escapeHtml(link.url)}</div>
                </div>
                <div class="d-flex gap-1">
                    <button class="btn btn-link p-0 me-2" onclick="editLink(${JSON.stringify(link).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="btn btn-link text-danger p-0" onclick="deleteLink('${link.id}')">Del</button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        el.innerHTML = '<small class="text-danger">Error loading links.</small>';
    }
}

/* --- ADMIN: Link CRUD --- */
async function saveLink(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const id = document.getElementById('link-id').value;
    const payload = {
        title: document.getElementById('link-title').value,
        url: document.getElementById('link-url').value,
        icon: document.getElementById('link-icon').value || 'bi-link-45deg',
        link_type: document.getElementById('link-type').value,
        internal_target: document.getElementById('link-internal-target').value || null,
        style_bg: document.getElementById('link-style-bg').value || null,
        display_order: parseInt(document.getElementById('link-order').value) || 0,
        is_active: document.getElementById('link-active').checked,
    };

    try {
        if (id) {
            // Update existing link
            const { error } = await supabase
                .from('links')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        } else {
            // Insert new link
            const { error } = await supabase
                .from('links')
                .insert([payload]);
            if (error) throw error;
        }

        e.target.reset();
        document.getElementById('link-id').value = '';
        document.getElementById('link-active').checked = true;
        refreshAdminLinks();
    } catch (err) {
        alert('Failed to save link: ' + (err.message || 'Unknown error'));
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Link";
    }
}

function editLink(linkData) {
    document.getElementById('link-id').value = linkData.id;
    document.getElementById('link-title').value = linkData.title;
    document.getElementById('link-url').value = linkData.url;
    document.getElementById('link-icon').value = linkData.icon || 'bi-link-45deg';
    document.getElementById('link-type').value = linkData.link_type || 'external';
    document.getElementById('link-internal-target').value = linkData.internal_target || '';
    document.getElementById('link-style-bg').value = linkData.style_bg || '';
    document.getElementById('link-order').value = linkData.display_order || 0;
    document.getElementById('link-active').checked = linkData.is_active;

    toggleInternalFields();
    document.getElementById('link-title').focus();

    // Scroll to form
    document.getElementById('link-editor-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function deleteLink(id) {
    if (confirm('Delete this link?')) {
        try {
            const { error } = await supabase.from('links').delete().eq('id', id);
            if (error) throw error;
            refreshAdminLinks();
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    }
}

function toggleInternalFields() {
    const type = document.getElementById('link-type').value;
    const internalFields = document.getElementById('internal-fields');
    if (internalFields) {
        internalFields.style.display = type === 'internal' ? 'block' : 'none';
    }
}

/* --- ADMIN: Resource CRUD --- */
async function saveResource(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = "Saving...";

    const table = document.getElementById('form-sheet').value.toLowerCase(); // 'freebies' or 'gear'
    const id = document.getElementById('form-id').value;
    const title = document.getElementById('form-title').value;
    const link = document.getElementById('form-link').value;
    const extra = document.getElementById('form-extra').value;

    const payload = { title, link };
    if (table === 'freebies') payload.description = extra;
    else payload.category = extra;

    try {
        if (id) {
            const { error } = await supabase.from(table).update(payload).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from(table).insert([payload]);
            if (error) throw error;
        }

        document.getElementById('form-id').value = "";
        e.target.reset();
        refreshAdmin();
    } catch (err) {
        alert('Failed: ' + (err.message || 'Unknown error'));
    } finally {
        btn.disabled = false;
        btn.innerText = "Save to Database";
    }
}

function editItem(table, data) {
    const sheetName = table.charAt(0).toUpperCase() + table.slice(1);
    document.getElementById('form-sheet').value = sheetName;
    document.getElementById('form-id').value = data.id;
    document.getElementById('form-title').value = data.title;
    document.getElementById('form-link').value = data.link;
    document.getElementById('form-extra').value = data.description || data.category || '';
    document.getElementById('form-title').focus();
}

async function deleteItem(table, id) {
    if (confirm('Delete this item?')) {
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            refreshAdmin();
        } catch (err) {
            alert('Failed to delete: ' + err.message);
        }
    }
}

/* --- ADMIN: Confirm Booking --- */
async function confirmBooking(id, name, email, topic, schedule) {
    const meetLink = prompt(`Enter Google Meet link for ${name}'s session on ${formatDate(schedule)}:`, 'https://meet.google.com/');
    if (!meetLink) return;

    try {
        const { error } = await supabase
            .from('bookings')
            .update({ meetlink: meetLink, status: 'confirmed' })
            .eq('id', id);

        if (error) throw error;

        alert('Confirmed! Meet link saved.');
        refreshAdmin();
    } catch (err) {
        alert('Failed: ' + err.message);
    }
}

/* --- HELPERS --- */
function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    } catch (e) { return isoString; }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Date Restrictor (Prevent Past Dates)
    const scheduleInput = document.getElementById('schedule');
    if (scheduleInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        scheduleInput.min = now.toISOString().slice(0, 16);
    }

    // 2. Load dynamic links on public page
    if (document.getElementById('dynamic-links')) {
        loadLinks();
    }

    // 3. Admin session check
    if (document.getElementById('loginGate')) checkAdminSession();

    // 4. Initial animations
    if (typeof anime !== 'undefined') {
        anime({ targets: '.fade-in-up', opacity: [0, 1], translateY: [40, 0], delay: anime.stagger(150), duration: 1000, easing: 'easeOutExpo' });
    }

    // 5. Link type toggle listener
    const linkTypeSelect = document.getElementById('link-type');
    if (linkTypeSelect) {
        linkTypeSelect.addEventListener('change', toggleInternalFields);
    }
});