import { requireSupabase } from '../shared/supabase.js';
import { initAdmin } from './admin.js';

function showLoginGate() {
  document.getElementById('loginGate')?.classList.remove('hidden');
  document.getElementById('dashboard')?.classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginGate')?.classList.add('hidden');
  document.getElementById('dashboard')?.classList.remove('hidden');
}

export async function checkAdminSession() {
  if (!document.getElementById('dashboard')) {
    return;
  }

  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) {
      showLoginGate();
      return;
    }

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      await client.auth.signOut();
      showLoginGate();
      return;
    }

    showDashboard();
    initAdmin();
  } catch {
    showLoginGate();
  }
}

export async function adminLogin() {
  const user = document.getElementById('user').value;
  const pass = document.getElementById('pass').value;
  const submitButton =
    document.querySelector('#loginGate button[type="submit"]') ||
    document.querySelector('#loginGate button');

  if (submitButton) {
    submitButton.disabled = true;
  }

  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email: user, password: pass });
    if (error || !data.session) {
      throw error || new Error('Invalid credentials');
    }

    showDashboard();
    initAdmin();
  } catch (error) {
    showLoginGate();
    alert(`Access Denied: ${error.message || 'Invalid credentials'}`);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
}

export async function adminLogout() {
  try {
    const client = requireSupabase();
    await client.auth.signOut();
  } finally {
    showLoginGate();
    window.location.reload();
  }
}
