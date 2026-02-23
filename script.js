/* script.js */

// ⚠️ PASTE YOUR NEW DEPLOYMENT URL HERE
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzCqXEeO2kWM4m2AfaoEjq7P-Aj5ji7321RlH3Gmig9CJJjHPyKmxGpuR1oP6nwlyxl/exec'; 

// CACHE SYSTEM: Stores data here so we don't fetch twice
const DATA_CACHE = {
    Freebies: null, // Will hold the Promise
    Gear: null
};

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
    location.reload();
}

/* --- NAVIGATION --- */
function navigateTo(id) {
    const current = document.querySelector('.active');
    const next = document.getElementById(id);
    if (id === 'freebies') fetchResources('Freebies', 'freebies-list');
    if (id === 'gear') fetchResources('Gear', 'gear-list');
    if (current) {
        anime({ targets: current, opacity: 0, translateY: -20, duration: 300, easing: 'easeInQuad', complete: () => { current.classList.remove('active'); current.style.display = 'none'; showView(next); }});
    } else { showView(next); }
}
function showView(el) { el.style.display = 'block'; el.classList.add('active'); anime({ targets: el, opacity: [0, 1], translateY: [20, 0], duration: 500, easing: 'easeOutExpo' }); }

/* --- PUBLIC FUNCTIONS --- */
async function fetchResources(sheet, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `<div class="text-muted small text-center py-4">Loading data...</div>`;
    try {
        const response = await fetch(`${SCRIPT_URL}?sheet=${sheet}`);
        const data = await response.json();
        container.innerHTML = data.length ? data.map(item => `
            <a href="${item.link}" target="_blank" class="link-card">
                <div><div class="fw-bold">${item.title}</div><div class="small text-muted">${item.description || item.category || ''}</div></div>
                <i class="bi bi-box-arrow-up-right"></i>
            </a>`).join('') : '<div class="text-muted small text-center">No items found.</div>';
    } catch (err) { container.innerHTML = `<div class="text-danger small text-center">Failed to load.</div>`; }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const hp = document.getElementById('hp_field').value;
    if (hp !== "") return; 
    btn.disabled = true; btn.innerText = "Processing...";
    const payload = {
        action: 'submitConsultation',
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        topic: document.getElementById('topic').value,
        schedule: document.getElementById('schedule').value,
        honeypot: hp
    };
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.success) { alert('Success! Session booked.'); navigateTo('home'); e.target.reset(); }
        else { alert('Error: ' + result.error); }
    } catch (err) { alert('Connection Failed.'); } 
    finally { btn.disabled = false; btn.innerText = "Submit Request"; }
}

/* --- ADMIN FUNCTIONS --- */
async function adminLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const btn = document.querySelector('#loginGate button');
    btn.disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'checkLogin', user, pass }) });
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('cyc_admin_auth', 'true');
            localStorage.setItem('cyc_admin_user', user);
            document.getElementById('loginGate').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            refreshAdmin();
        } else alert('Access Denied');
    } catch (err) { alert('Connection Failed'); } 
    finally { btn.disabled = false; }
}

async function refreshAdmin() {
    const sheets = ['Freebies', 'Gear', 'Bookings'];
    for (let s of sheets) {
        const el = document.getElementById(`list-${s.toLowerCase()}`);
        if (!el) continue;
        el.innerHTML = '<small class="text-muted">Syncing...</small>';
        try {
            const res = await fetch(`${SCRIPT_URL}?sheet=${s}`);
            const data = await res.json();
            if (s === 'Bookings') {
                el.innerHTML = data.length ? data.map(r => {
                    // Check if Meet Link exists in column 7 (meetlink)
                    const isConfirmed = r.meetlink && r.meetlink !== "";
                    const actionBtn = isConfirmed 
                        ? `<a href="${r.meetlink}" target="_blank" class="btn btn-sm btn-success fw-bold" style="font-size:0.75rem;"><i class="bi bi-camera-video"></i> Join Meet</a>`
                        : `<button class="btn btn-sm btn-outline-dark" style="font-size: 0.75rem;" onclick="confirmBooking('${r.id}', '${r.name}', '${r.email}', '${r.topic}', '${r.schedule}')"><i class="bi bi-check-lg"></i> Confirm</button>`;

                    return `
                    <div class="border-bottom py-3 small">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="fw-bold">${r.name}</div>
                                <div class="badge bg-light text-dark border mb-1">${r.topic}</div>
                                <div class="text-muted">Req: ${formatDate(r.schedule)}</div>
                                <div class="text-muted fst-italic">${r.email}</div>
                            </div>
                            <div class="d-flex flex-column gap-2 text-end">
                                ${actionBtn}
                                <button class="btn btn-link text-danger p-0 text-decoration-none" style="font-size:0.75rem;" onclick="deleteItem('Bookings', '${r.id}')">Delete</button>
                            </div>
                        </div>
                    </div>`;
                }).join('') : '<small class="text-muted">No bookings.</small>';
            } else {
                el.innerHTML = data.map(r => `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${r.title}</span><div><button class="btn btn-link p-0 me-2" onclick="editItem('${s}', ${JSON.stringify(r).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteItem('${s}','${r.id}')">Del</button></div></div>`).join('');
            }
        } catch (err) { el.innerHTML = '<small class="text-danger">Error.</small>'; }
    }
}

function formatDate(isoString) {
    if (!isoString) return 'N/A';
    try { return new Date(isoString).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'numeric' }); } 
    catch (e) { return isoString; }
}

async function confirmBooking(id, name, email, topic, schedule) {
    if (!confirm(`Create Google Meet and send invites?\n\nTo: ${email}\nDate: ${formatDate(schedule)}`)) return;
    try {
        const payload = { action: 'addToCalendar', id, name, email, topic, schedule };
        const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            alert('Confirmed! Google Meet link created.');
            refreshAdmin(); // This will re-fetch and show the green "Join Meet" button
        } else { alert('Failed: ' + data.error); }
    } catch (err) { alert('Network Error'); }
}

/* --- 6. RESOURCE CRUD --- */

async function saveResource(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.innerText = "Saving...";
    const sheet = document.getElementById('form-sheet').value;
    const id = document.getElementById('form-id').value;
    const title = document.getElementById('form-title').value;
    const link = document.getElementById('form-link').value;
    const extra = document.getElementById('form-extra').value;
    const action = id ? 'updateResource' : 'addResource';
    const dataObj = { title, link };
    if (sheet === "Freebies") dataObj.description = extra; else dataObj.category = extra;
    const payload = id ? { action, sheet, id, data: dataObj } : { action, sheet, ...dataObj };
    try { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) }); document.getElementById('form-id').value = ""; refreshAdmin(); e.target.reset(); } 
    catch (err) { alert('Failed'); } finally { btn.disabled = false; btn.innerText = "Save to Database"; }
}
function editItem(sheet, data) {
    document.getElementById('form-sheet').value = sheet;
    document.getElementById('form-id').value = data.id;
    document.getElementById('form-title').value = data.title;
    document.getElementById('form-link').value = data.link;
    document.getElementById('form-extra').value = data.description || data.category;
    document.getElementById('form-title').focus();
}
async function deleteItem(sheet, id) {
    if (confirm('Delete?')) { await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteResource', sheet, id }) }); refreshAdmin(); }
}

/* --- INITIALIZATION --- */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Date Restrictor (Prevent Past Dates)
    const scheduleInput = document.getElementById('schedule');
    if (scheduleInput) {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Local timezone fix
        scheduleInput.min = now.toISOString().slice(0, 16);
    }

    if (document.getElementById('loginGate')) checkAdminSession();
    if (typeof anime !== 'undefined') anime({ targets: '.fade-in-up', opacity: [0, 1], translateY: [40, 0], delay: anime.stagger(150), duration: 1000, easing: 'easeOutExpo' });
});