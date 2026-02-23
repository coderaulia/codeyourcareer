/* js/public.js - Public Page Data & Interactions */

async function loadSiteSettings() {
    try {
        const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).single();
        if (error || !data) return;
        applyTheme(data);
        applyContent(data);
    } catch (e) { console.log('Settings load skipped'); }
}

function applyTheme(s) {
    const r = document.documentElement.style;
    r.setProperty('--bg-color', s.bg_color || '#f8f9fa');
    r.setProperty('--text-main', s.text_color || '#111111');
    r.setProperty('--text-sec', s.text_secondary || '#555555');
    r.setProperty('--accent', s.accent_color || '#000000');
    r.setProperty('--card-bg', s.card_bg || '#ffffff');
    r.setProperty('--card-border', s.card_border || '#e0e0e0');
    r.setProperty('--cta-bg', s.cta_bg || '#111111');
    r.setProperty('--cta-text', s.cta_text || '#ffffff');
    r.setProperty('--cta-btn-bg', s.cta_btn_bg || '#ffffff');
    r.setProperty('--cta-btn-text', s.cta_btn_text || '#000000');
}

function applyContent(s) {
    const el = id => document.getElementById(id);
    if (el('site-name')) el('site-name').textContent = s.site_name || '';
    if (el('site-headline')) el('site-headline').textContent = s.headline || '';
    if (el('site-subheadline')) el('site-subheadline').textContent = s.subheadline || '';
    if (el('site-footer')) el('site-footer').innerHTML = '<p>' + escapeHtml(s.footer_text || '') + '</p>';
    if (el('cta-title')) el('cta-title').textContent = s.cta_title || '';
    if (el('cta-subtitle')) el('cta-subtitle').textContent = s.cta_subtitle || '';
    if (el('cta-button')) el('cta-button').textContent = s.cta_button_text || '';

    // Logo
    const logoEl = el('site-logo');
    if (logoEl) {
        if (s.logo_type === 'emoji') logoEl.innerHTML = '<div class="logo-emoji">' + (escapeHtml(s.logo_emoji) || '💻') + '</div>';
        else if (s.logo_type === 'image' && s.logo_image_url) logoEl.innerHTML = '<img class="logo-image" src="' + escapeHtml(s.logo_image_url) + '" alt="Logo">';
        else if (s.logo_svg) logoEl.innerHTML = '<div class="logo-svg">' + s.logo_svg + '</div>';
    }
}

async function loadModules() {
    try {
        const { data, error } = await sb.from('modules').select('*').order('display_order');
        if (error || !data) return;
        data.forEach(m => { MODULES[m.slug] = m.is_enabled; });

        const show = (id, flag) => { const e = document.getElementById(id); if (e) e.style.display = flag ? '' : 'none'; };
        show('cta-section', MODULES.consultation);
        show('testimonials-section', MODULES.testimonials);
        show('contact-home-section', MODULES.contact);

        if (MODULES.testimonials) loadTestimonials();
    } catch (e) { console.log('Modules load skipped'); }
}

async function loadLinks() {
    const c = document.getElementById('dynamic-links');
    if (!c) return;
    try {
        const { data, error } = await sb.from('links').select('*').eq('is_active', true).order('display_order');
        if (error) throw error;
        if (!data || !data.length) { c.innerHTML = '<div class="text-muted small text-center">No links yet.</div>'; return; }
        const ext = data.filter(l => l.link_type === 'external');
        const int = data.filter(l => l.link_type === 'internal');

        let h = '';
        ext.forEach(l => {
            const clickTrack = MODULES.analytics ? `onclick="trackClick('${l.id}','${escapeHtml(l.title)}'); return true;"` : '';
            h += `<a href="${l.url}" target="_blank" class="link-card" ${clickTrack}><span class="link-icon"><i class="bi ${l.icon}"></i></span><span class="link-text">${l.title}</span><i class="bi bi-arrow-right"></i></a>`;
        });

        if (ext.length && int.length) h += '<div class="my-2"></div>';

        int.forEach(l => {
            const bg = l.style_bg ? 'background-color:' + escapeHtml(l.style_bg) + ';' : '';
            const ico = l.internal_target === 'freebies' ? 'bi-download' : 'bi-box-arrow-up-right';
            const clickTrack = MODULES.analytics ? `trackClick('${l.id}','${escapeHtml(l.title)}'); ` : '';
            h += `<div onclick="${clickTrack}navigateTo('${escapeHtml(l.internal_target)}')" class="link-card" style="${bg}"><span class="link-icon"><i class="bi ${l.icon}"></i></span><span class="link-text">${l.title}</span><i class="bi ${ico}"></i></div>`;
        });

        c.innerHTML = h;
    } catch (e) { console.error('Links error:', e); }
}

async function fetchResources(table, containerId) {
    const c = document.getElementById(containerId); if (!c) return;
    c.innerHTML = '<div class="text-muted small text-center py-4">Loading...</div>';
    try {
        const { data, error } = await sb.from(table).select('*').order('display_order');
        if (error) throw error;
        c.innerHTML = data && data.length ? data.map(i => `<a href="${i.link}" target="_blank" class="link-card"><div><div class="fw-bold">${escapeHtml(i.title)}</div><div class="small text-muted">${escapeHtml(i.description || i.category || '')}</div></div><i class="bi bi-box-arrow-up-right"></i></a>`).join('') : '<div class="text-muted small text-center">No items found.</div>';
    } catch (e) { c.innerHTML = '<div class="text-danger small text-center">Failed to load.</div>'; }
}

async function handleFormSubmit(e) {
    e.preventDefault(); const btn = e.target.querySelector('button');
    if (document.getElementById('hp_field').value !== '') return;
    btn.disabled = true; btn.innerText = 'Processing...';
    try {
        const { error } = await sb.from('bookings').insert([{ name: document.getElementById('name').value, email: document.getElementById('email').value, topic: document.getElementById('topic').value, schedule: document.getElementById('schedule').value }]);
        if (error) throw error;
        alert('Success! Session booked.'); navigateTo('home'); e.target.reset();
    } catch (err) { alert('Error: ' + (err.message || 'Failed')); }
    finally { btn.disabled = false; btn.innerText = 'Submit Request'; }
}

async function loadTestimonials() {
    const c = document.getElementById('testimonials-list'); if (!c) return;
    try {
        const { data } = await sb.from('testimonials').select('*').eq('is_featured', true).order('display_order');
        if (!data || !data.length) { document.getElementById('testimonials-section').style.display = 'none'; return; }
        c.innerHTML = data.map(t => `<div class="testimonial-card"><div class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div><div class="quote">"${escapeHtml(t.content)}"</div><div class="author">${escapeHtml(t.name)}</div>${t.role ? '<div class="role">' + escapeHtml(t.role) + '</div>' : ''}</div>`).join('');
    } catch (e) { }
}

async function handleContactSubmit(e) {
    e.preventDefault(); const btn = e.target.querySelector('button');
    if (document.getElementById('hp_contact').value !== '') return;
    btn.disabled = true; btn.innerText = 'Sending...';
    try {
        const { error } = await sb.from('contact_messages').insert([{ name: document.getElementById('contact-name').value, email: document.getElementById('contact-email').value, message: document.getElementById('contact-message').value }]);
        if (error) throw error;
        alert('Message sent! Thank you.'); navigateTo('home'); e.target.reset();
    } catch (err) { alert('Error: ' + (err.message || 'Failed')); }
    finally { btn.disabled = false; btn.innerText = 'Send Message'; }
}

function trackClick(linkId, title) {
    if (typeof sb !== 'undefined') {
        sb.from('link_clicks').insert([{ link_id: linkId, link_title: title }]).then(() => { });
    }
}

/* Application Initialization (Public site) */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Date Restrictor
    const scheduleInput = document.getElementById('schedule');
    if (scheduleInput) {
        const n = new Date(); n.setMinutes(n.getMinutes() - n.getTimezoneOffset()); scheduleInput.min = n.toISOString().slice(0, 16);
    }

    // 2. Load Public Data
    if (document.getElementById('dynamic-links')) {
        loadSiteSettings();
        loadModules();
        loadLinks();
    }

    // 3. Initiate Auth validation
    if (typeof checkAdminSession === 'function') {
        if (document.getElementById('loginGate')) checkAdminSession();
    }

    // 4. Initial animations
    if (typeof anime !== 'undefined') {
        anime({ targets: '.fade-in-up', opacity: [0, 1], translateY: [40, 0], delay: anime.stagger(150), duration: 1000, easing: 'easeOutExpo' });
    }
});
