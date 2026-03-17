import { apiRequest, uploadRequest } from './http.js';

export async function getVersionInfo() {
  return apiRequest('/version');
}

export async function getSiteSettings() {
  return apiRequest('/site-settings');
}

export async function updateSiteSettings(payload) {
  return apiRequest('/admin/site-settings', {
    method: 'PUT',
    body: payload,
  });
}

export async function uploadImage(file) {
  return uploadRequest('/admin/uploads/image', file);
}

export async function getModules() {
  return apiRequest('/modules');
}

export async function updateModuleStatus(slug, isEnabled) {
  return apiRequest(`/admin/modules/${slug}`, {
    method: 'PUT',
    body: { is_enabled: isEnabled },
  });
}

export async function reorderCollection(collection, orderedIds) {
  return apiRequest(`/admin/order/${collection}`, {
    method: 'PUT',
    body: { orderedIds },
  });
}

export async function getActiveLinks() {
  return apiRequest('/links/active');
}

export async function getAllLinks() {
  return apiRequest('/admin/links');
}

export async function saveLink(id, payload) {
  return apiRequest(id ? `/admin/links/${id}` : '/admin/links', {
    method: id ? 'PUT' : 'POST',
    body: payload,
  });
}

export async function deleteLink(id) {
  return apiRequest(`/admin/links/${id}`, {
    method: 'DELETE',
  });
}

export async function getResources(table) {
  return apiRequest(`/resources/${table}`);
}

export async function saveResource(table, id, payload) {
  return apiRequest(id ? `/admin/resources/${table}/${id}` : `/admin/resources/${table}`, {
    method: id ? 'PUT' : 'POST',
    body: payload,
  });
}

export async function deleteResource(table, id) {
  return apiRequest(`/admin/resources/${table}/${id}`, {
    method: 'DELETE',
  });
}

export async function createBooking(payload) {
  return apiRequest('/bookings', {
    method: 'POST',
    body: payload,
  });
}

export async function getBookings() {
  return apiRequest('/admin/bookings');
}

export async function updateBookingConfirmation(id, meetLink) {
  return apiRequest(`/admin/bookings/${id}/confirm`, {
    method: 'PUT',
    body: { meetlink: meetLink },
  });
}

export async function updateBookingStatus(id, status, meetLink = '') {
  return apiRequest(`/admin/bookings/${id}/status`, {
    method: 'PUT',
    body: { status, meetlink: meetLink || null },
  });
}

export async function deleteBooking(id) {
  return apiRequest(`/admin/bookings/${id}`, {
    method: 'DELETE',
  });
}

export async function getFeaturedTestimonials() {
  return apiRequest('/testimonials/featured');
}

export async function getTestimonials() {
  return apiRequest('/admin/testimonials');
}

export async function saveTestimonial(id, payload) {
  return apiRequest(id ? `/admin/testimonials/${id}` : `/admin/testimonials`, {
    method: id ? 'PUT' : 'POST',
    body: payload,
  });
}

export async function deleteTestimonial(id) {
  return apiRequest(`/admin/testimonials/${id}`, {
    method: 'DELETE',
  });
}

export async function createContactMessage(payload) {
  return apiRequest('/contact-messages', {
    method: 'POST',
    body: payload,
  });
}

export async function getContactMessages() {
  return apiRequest('/admin/contact-messages');
}

export async function setContactMessageRead(id, isRead) {
  return apiRequest(`/admin/contact-messages/${id}/read`, {
    method: 'PUT',
    body: { is_read: isRead },
  });
}

export async function deleteContactMessage(id) {
  return apiRequest(`/admin/contact-messages/${id}`, {
    method: 'DELETE',
  });
}

export function recordLinkClick(payload) {
  return apiRequest('/link-clicks', {
    method: 'POST',
    body: {
      linkId: payload.link_id,
      linkTitle: payload.link_title,
    },
  });
}

export async function getRecentLinkClicks(limit = 100) {
  return apiRequest(`/admin/analytics/link-clicks?limit=${limit}`);
}

export async function getDashboardStats() {
  return apiRequest('/admin/dashboard-stats');
}
