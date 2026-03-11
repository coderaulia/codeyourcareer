import { apiRequest } from './http.js';

export async function getSession() {
  return apiRequest('/auth/session');
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function loginWithPassword(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function logout() {
  return apiRequest('/auth/logout', {
    method: 'POST',
  });
}
