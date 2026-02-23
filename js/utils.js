/* js/utils.js - Shared utility functions */

const MODULES = {};

function escapeHtml(s) {
    return s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
}

function formatDate(d) {
    if (!d) return 'N/A';
    try {
        return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    } catch (e) {
        return d;
    }
}

/* ========== NAVIGATION ========== */
function navigateTo(id) {
    const current = document.querySelector('.active');
    const next = document.getElementById(id);
    if (id === 'freebies' && typeof fetchResources === 'function') fetchResources('freebies', 'freebies-list');
    if (id === 'gear' && typeof fetchResources === 'function') fetchResources('gear', 'gear-list');

    if (current) {
        if (typeof anime !== 'undefined') {
            anime({
                targets: current, opacity: 0, translateY: -20, duration: 300, easing: 'easeInQuad',
                complete: () => { current.classList.remove('active'); current.style.display = 'none'; showView(next); }
            });
        } else {
            current.classList.remove('active'); current.style.display = 'none'; showView(next);
        }
    } else {
        showView(next);
    }
}

function showView(el) {
    el.style.display = 'block';
    el.classList.add('active');
    if (typeof anime !== 'undefined') {
        anime({ targets: el, opacity: [0, 1], translateY: [20, 0], duration: 500, easing: 'easeOutExpo' });
    }
}
