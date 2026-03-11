import { changePassword, getCurrentUser, getSession, loginWithPassword, logout } from '../api/auth.js';
import { formatErrorMessage, setButtonBusy, showToast } from '../shared/utils.js';
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
    initAdmin(user);
  } catch {
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
    showToast('You have been signed out.', {
      tone: 'info',
      title: 'Signed out',
    });
  } finally {
    showLoginGate();
    window.location.reload();
  }
}
