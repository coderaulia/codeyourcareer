/* js/auth.js - Authentication & Session */

function checkAdminSession() {
    if (document.getElementById('dashboard') && localStorage.getItem('cyc_admin_auth') === 'true') {
        document.getElementById('loginGate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        if (typeof initAdmin === 'function') initAdmin();
    }
}

function adminLogout() {
    localStorage.removeItem('cyc_admin_auth');
    localStorage.removeItem('cyc_admin_user');
    sb.auth.signOut();
    location.reload();
}

async function adminLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    // Check if we are inside a form to find the correct button, otherwise fallback to id selector
    const btn = document.querySelector('#loginGate button[type="submit"]') || document.querySelector('#loginGate button');
    if (btn) btn.disabled = true;

    try {
        const { error } = await sb.auth.signInWithPassword({ email: user, password: pass });
        if (error) throw error;
        localStorage.setItem('cyc_admin_auth', 'true');
        localStorage.setItem('cyc_admin_user', user);

        document.getElementById('loginGate').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        if (typeof initAdmin === 'function') initAdmin();
    } catch (err) {
        alert('Access Denied: ' + (err.message || 'Invalid credentials'));
    } finally {
        if (btn) btn.disabled = false;
    }
}
