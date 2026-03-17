import { clearCsrfToken } from '../api/http.js';
import { changePassword, getCurrentUser, getSession, loginWithPassword, logout } from '../api/auth.js';
import { formatErrorMessage, setButtonBusy, showToast } from '../shared/utils.js';
import { initAdmin } from './admin.js';

const authEventKey = 'cyc_admin_auth_event';
let authChannel;
let listenersBound = false;

function showLoginGate() {
  document.getElementById('loginGate')?.classList.remove('hidden');
  document.getElementById('dashboard')?.classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginGate')?.classList.add('hidden');
  document.getElementById('dashboard')?.classList.remove('hidden');
}

function broadcastAuthEvent(type) {
  const payload = { type, timestamp: Date.now() };

  if (typeof BroadcastChannel !== 'undefined') {
    authChannel ??= new BroadcastChannel('cyc-admin-auth');
    authChannel.postMessage(payload);
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(authEventKey, JSON.stringify(payload));
  }
}

function handleAuthSignal(type, notify = false) {
  if (type === 'logout' || type === 'expired') {
    clearCsrfToken();
    showLoginGate();
    if (notify) {
      showToast('Your admin session ended. Sign in again to continue.', {
        tone: 'info',
        title: 'Session closed',
      });
    }
    return;
  }

  if (type === 'login' || type === 'refresh') {
    void checkAdminSession();
  }
}

function bindAuthListeners() {
  if (listenersBound || typeof window === 'undefined') {
    return;
  }

  listenersBound = true;

  if (typeof BroadcastChannel !== 'undefined') {
    authChannel ??= new BroadcastChannel('cyc-admin-auth');
    authChannel.addEventListener('message', (event) => {
      handleAuthSignal(event.data?.type, event.data?.type === 'logout');
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== authEventKey || !event.newValue) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue);
      handleAuthSignal(payload.type, payload.type === 'logout');
    } catch {
      // Ignore malformed storage events.
    }
  });

  window.addEventListener('cyc:auth-state', (event) => {
    handleAuthSignal(event.detail?.type || 'expired', true);
  });
}

export async function checkAdminSession() {
  if (!document.getElementById('dashboard')) {
    return;
  }

  bindAuthListeners();

  try {
    const session = await getSession();
    if (!session?.authenticated) {
      clearCsrfToken();
      showLoginGate();
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      clearCsrfToken();
      showLoginGate();
      return;
    }

    showDashboard();
    initAdmin(user);
  } catch {
    clearCsrfToken();
    showLoginGate();
  }
}

export async function adminLogin() {
  const user = document.getElementById('user')?.value?.trim() || '';
  const pass = document.getElementById('pass')?.value || '';
  const submitButton =
    document.querySelector('#loginGate button[type="submit"]') ||
    document.querySelector('#loginGate button');

  setButtonBusy(submitButton, true, 'Signing in...');

  try {
    const session = await loginWithPassword(user, pass);
    if (!session?.authenticated) {
      throw new Error('Invalid email or password.');
    }

    showDashboard();
    initAdmin(session.user);
    broadcastAuthEvent('login');
    showToast('Welcome back. Your admin session is ready.', {
      tone: 'success',
      title: 'Signed in',
    });
  } catch (error) {
    showLoginGate();
    showToast(formatErrorMessage(error, 'Unable to sign in right now.'), {
      tone: 'error',
      title: 'Access denied',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export async function submitPasswordChange(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('current-password')?.value || '';
  const newPassword = document.getElementById('new-password')?.value || '';
  const confirmPassword = document.getElementById('confirm-password')?.value || '';
  const submitButton = event.target.querySelector('button[type="submit"]');

  setButtonBusy(submitButton, true, 'Updating password...');

  try {
    await changePassword(currentPassword, newPassword, confirmPassword);
    event.target.reset();
    broadcastAuthEvent('refresh');
    showToast('Your admin password has been updated.', {
      tone: 'success',
      title: 'Password changed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to update your password right now.'), {
      tone: 'error',
      title: 'Password update failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export async function adminLogout() {
  try {
    await logout();
  } finally {
    clearCsrfToken();
    broadcastAuthEvent('logout');
    showLoginGate();
    window.location.reload();
  }
}
