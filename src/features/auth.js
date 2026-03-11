import { getCurrentUser, getSession, loginWithPassword, logout } from '../api/auth.js';
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
    const session = await getSession();
    if (!session?.authenticated) {
      showLoginGate();
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
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
    const session = await loginWithPassword(user, pass);
    if (!session?.authenticated) {
      throw new Error('Invalid credentials');
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
    await logout();
  } finally {
    showLoginGate();
    window.location.reload();
  }
}
