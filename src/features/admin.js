import { requireSupabase } from '../shared/supabase.js';
import { escapeHtml, formatDate } from '../shared/utils.js';

function getClient() {
  return requireSupabase();
}

export function switchAdminTab(button, tabName) {
  document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.classList.remove('active');
  });

  document.getElementById(`tab-${tabName}`)?.classList.add('active');
  button?.classList.add('active');
}

export function initAdmin() {
  refreshDashboard();
  loadSiteSettingsAdmin();
  refreshAdminLinks();
  refreshResources();
  refreshBookings();
  refreshModulesAdmin();
}

export async function refreshDashboard() {
  const client = getClient();

  client.from('links').select('id', { count: 'exact' }).then(({ count }) => {
    const element = document.getElementById('stat-links');
    if (element) {
      element.textContent = count !== null ? count : 0;
    }
  });

  client
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('status', 'pending')
    .then(({ count }) => {
      const element = document.getElementById('stat-bookings');
      if (element) {
        element.textContent = count !== null ? count : 0;
      }
    });

  client
    .from('contact_messages')
    .select('id', { count: 'exact' })
    .eq('is_read', false)
    .then(({ count }) => {
      const element = document.getElementById('stat-messages');
      if (element) {
        element.textContent = count !== null ? count : 0;
      }
    });

  client.from('link_clicks').select('id', { count: 'exact' }).then(({ count }) => {
    const element = document.getElementById('stat-clicks');
    if (element) {
      element.textContent = count !== null ? count : 0;
    }
  });
}

export async function loadSiteSettingsAdmin() {
  try {
    const client = getClient();
    const { data } = await client
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!data) {
      return;
    }

    const setValue = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.value = value || '';
      }
    };

    setValue('set-site-name', data.site_name);
    setValue('set-headline', data.headline);
    setValue('set-subheadline', data.subheadline);
    setValue('set-footer', data.footer_text);
    setValue('set-cta-title', data.cta_title);
    setValue('set-cta-subtitle', data.cta_subtitle);
    setValue('set-cta-button', data.cta_button_text);
    setValue('set-logo-type', data.logo_type);
    setValue('set-logo-svg', data.logo_svg);
    setValue('set-logo-image', data.logo_image_url);
    setValue('set-logo-emoji', data.logo_emoji);
    setValue('set-bg-color', data.bg_color);
    setValue('set-text-color', data.text_color);
    setValue('set-text-sec', data.text_secondary);
    setValue('set-accent', data.accent_color);
    setValue('set-card-bg', data.card_bg);
    setValue('set-card-border', data.card_border);
    setValue('set-cta-bg', data.cta_bg);
    setValue('set-cta-text', data.cta_text);
    setValue('set-cta-btn-bg', data.cta_btn_bg);
    setValue('set-cta-btn-text', data.cta_btn_text);

    toggleLogoFields();
  } catch {
  }
}

export async function saveSiteSettings() {
  const client = getClient();
  const getValue = (id) => document.getElementById(id)?.value || '';

  const payload = {
    site_name: getValue('set-site-name'),
    headline: getValue('set-headline'),
    subheadline: getValue('set-subheadline'),
    footer_text: getValue('set-footer'),
    cta_title: getValue('set-cta-title'),
    cta_subtitle: getValue('set-cta-subtitle'),
    cta_button_text: getValue('set-cta-button'),
    logo_type: getValue('set-logo-type'),
    logo_svg: getValue('set-logo-svg'),
    logo_image_url: getValue('set-logo-image'),
    logo_emoji: getValue('set-logo-emoji'),
    bg_color: getValue('set-bg-color'),
    text_color: getValue('set-text-color'),
    text_secondary: getValue('set-text-sec'),
    accent_color: getValue('set-accent'),
    card_bg: getValue('set-card-bg'),
    card_border: getValue('set-card-border'),
    cta_bg: getValue('set-cta-bg'),
    cta_text: getValue('set-cta-text'),
    cta_btn_bg: getValue('set-cta-btn-bg'),
    cta_btn_text: getValue('set-cta-btn-text'),
  };

  try {
    const { error } = await client.from('site_settings').update(payload).eq('id', 1);
    if (error) {
      throw error;
    }
    alert('Settings saved!');
  } catch (error) {
    alert(`Failed: ${error.message}`);
  }
}

export function toggleLogoFields() {
  const typeSelector = document.getElementById('set-logo-type');
  if (!typeSelector) {
    return;
  }

  ['logo-svg-field', 'logo-image-field', 'logo-emoji-field'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.style.display = 'none';
    }
  });

  const fieldMap = {
    svg: 'logo-svg-field',
    image: 'logo-image-field',
    emoji: 'logo-emoji-field',
  };

  const targetField = fieldMap[typeSelector.value];
  if (targetField) {
    const element = document.getElementById(targetField);
    if (element) {
      element.style.display = '';
    }
  }
}

export async function refreshModulesAdmin() {
  const container = document.getElementById('module-list');
  if (!container) {
    return;
  }

  try {
    const client = getClient();
    const { data } = await client.from('modules').select('*').order('display_order');
    if (!data) {
      return;
    }

    container.innerHTML = data
      .map(
        (moduleItem) => `
          <div class="module-toggle-card ${moduleItem.is_enabled ? 'enabled' : ''}">
            <div>
              <i class="bi ${escapeHtml(moduleItem.icon)} me-2"></i>
              <strong>${escapeHtml(moduleItem.name)}</strong>
              <div class="text-muted small">${escapeHtml(moduleItem.description || '')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${moduleItem.is_enabled ? 'checked' : ''} onchange="toggleModule('${moduleItem.slug}', this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </div>`
      )
      .join('');

    const dashboardModules = document.getElementById('dashboard-active-modules');
    if (dashboardModules) {
      const activeModules = data.filter((moduleItem) => moduleItem.is_enabled);
      dashboardModules.innerHTML = activeModules.length
        ? activeModules
            .map(
              (moduleItem) =>
                `<div class="d-flex align-items-center small border p-2 rounded bg-light"><i class="bi ${escapeHtml(
                  moduleItem.icon
                )} me-2 text-primary"></i><span class="fw-bold">${escapeHtml(
                  moduleItem.name
                )}</span></div>`
            )
            .join('')
        : '<div class="text-muted small">No active modules.</div>';
    }

    data.forEach((moduleItem) => {
      const panel = document.getElementById(`mod-${moduleItem.slug}`);
      if (panel) {
        panel.style.display = moduleItem.is_enabled ? '' : 'none';
      }
    });

    if (data.find((moduleItem) => moduleItem.slug === 'testimonials' && moduleItem.is_enabled)) {
      refreshTestimonials();
    }
    if (data.find((moduleItem) => moduleItem.slug === 'contact' && moduleItem.is_enabled)) {
      refreshMessages();
    }
    if (data.find((moduleItem) => moduleItem.slug === 'analytics' && moduleItem.is_enabled)) {
      loadAnalytics();
    }
  } catch {
  }
}

export async function toggleModule(slug, enabled) {
  try {
    const client = getClient();
    const { error } = await client.from('modules').update({ is_enabled: enabled }).eq('slug', slug);
    if (error) {
      throw error;
    }
    refreshModulesAdmin();
  } catch (error) {
    alert(`Failed: ${error.message}`);
  }
}

export async function refreshAdminLinks() {
  const listElement = document.getElementById('list-links');
  if (!listElement) {
    return;
  }

  listElement.innerHTML = '<small class="text-muted">Loading...</small>';

  try {
    const client = getClient();
    const { data, error } = await client.from('links').select('*').order('display_order');
    if (error) {
      throw error;
    }

    listElement.innerHTML = data && data.length
      ? data
          .map((link) => {
            const badge = link.is_active
              ? '<span class="badge bg-success" style="font-size:0.6rem">ON</span>'
              : '<span class="badge bg-secondary" style="font-size:0.6rem">OFF</span>';
            const typeIcon = link.link_type === 'external' ? 'bi-box-arrow-up-right' : 'bi-folder2-open';
            return `<div class="d-flex justify-content-between align-items-center border-bottom py-2 small"><div><i class="bi ${typeIcon} me-1"></i><strong>${escapeHtml(
              link.title
            )}</strong> ${badge}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(
              link.url
            )}</div></div><div><button class="btn btn-link p-0 me-2" onclick='editLink(${JSON.stringify(link).replace(
              /'/g,
              '&#39;'
            )})'>Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteLink('${link.id}')">Del</button></div></div>`;
          })
          .join('')
      : '<small class="text-muted">No links.</small>';
  } catch {
    listElement.innerHTML = '<small class="text-danger">Error</small>';
  }
}

export async function saveLink(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerText = 'Saving...';

  const id = document.getElementById('link-id').value;
  const payload = {
    title: document.getElementById('link-title').value,
    url: document.getElementById('link-url').value,
    icon: document.getElementById('link-icon').value || 'bi-link-45deg',
    link_type: document.getElementById('link-type').value,
    internal_target: document.getElementById('link-internal-target').value || null,
    style_bg: document.getElementById('link-style-bg').value || null,
    display_order: Number.parseInt(document.getElementById('link-order').value, 10) || 0,
    is_active: document.getElementById('link-active').checked,
  };

  try {
    const client = getClient();
    const { error } = id
      ? await client.from('links').update(payload).eq('id', id)
      : await client.from('links').insert([payload]);
    if (error) {
      throw error;
    }
    resetLinkForm();
    event.target.reset();
    refreshAdminLinks();
  } catch (error) {
    alert(`Failed: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Save Link';
  }
}

export function editLink(link) {
  document.getElementById('link-id').value = link.id;
  document.getElementById('link-title').value = link.title;
  document.getElementById('link-url').value = link.url;
  document.getElementById('link-icon').value = link.icon || '';
  document.getElementById('link-type').value = link.link_type || 'external';
  document.getElementById('link-internal-target').value = link.internal_target || '';
  document.getElementById('link-style-bg').value = link.style_bg || '';
  document.getElementById('link-order').value = link.display_order || 0;
  document.getElementById('link-active').checked = link.is_active;
  toggleInternalFields();
  document.getElementById('link-title').focus();
}

export async function deleteLink(id) {
  if (!window.confirm('Delete?')) {
    return;
  }

  const client = getClient();
  await client.from('links').delete().eq('id', id);
  refreshAdminLinks();
}

export function resetLinkForm() {
  document.getElementById('link-id').value = '';
  document.getElementById('link-active').checked = true;
}

export function toggleInternalFields() {
  const fields = document.getElementById('internal-fields');
  if (fields) {
    fields.style.display = document.getElementById('link-type').value === 'internal' ? '' : 'none';
  }
}

export async function refreshResources() {
  for (const table of ['freebies', 'gear']) {
    const listElement = document.getElementById(`list-${table}`);
    if (!listElement) {
      continue;
    }

    listElement.innerHTML = '<small class="text-muted">Loading...</small>';

    try {
      const client = getClient();
      const { data } = await client.from(table).select('*').order('display_order');
      listElement.innerHTML = data && data.length
        ? data
            .map(
              (item) =>
                `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${escapeHtml(
                  item.title
                )}</span><div><button class="btn btn-link p-0 me-2" onclick="editItem('${table}', ${JSON.stringify(
                  item
                ).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteItem('${table}','${
                  item.id
                }')">Del</button></div></div>`
            )
            .join('')
        : '<small class="text-muted">Empty</small>';
    } catch {
      listElement.innerHTML = '<small class="text-danger">Error</small>';
    }
  }
}

export async function saveResource(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerText = 'Saving...';

  const table = document.getElementById('form-sheet').value.toLowerCase();
  const id = document.getElementById('form-id').value;
  const payload = {
    title: document.getElementById('form-title').value,
    link: document.getElementById('form-link').value,
  };

  if (table === 'freebies') {
    payload.description = document.getElementById('form-extra').value;
  } else {
    payload.category = document.getElementById('form-extra').value;
  }

  try {
    const client = getClient();
    const { error } = id
      ? await client.from(table).update(payload).eq('id', id)
      : await client.from(table).insert([payload]);
    if (error) {
      throw error;
    }
    document.getElementById('form-id').value = '';
    event.target.reset();
    refreshResources();
  } catch (error) {
    alert(`Failed: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Save to Database';
  }
}

export function editItem(table, item) {
  document.getElementById('form-sheet').value = table.charAt(0).toUpperCase() + table.slice(1);
  document.getElementById('form-id').value = item.id;
  document.getElementById('form-title').value = item.title;
  document.getElementById('form-link').value = item.link;
  document.getElementById('form-extra').value = item.description || item.category || '';
}

export async function deleteItem(table, id) {
  if (!window.confirm('Delete?')) {
    return;
  }

  const client = getClient();
  await client.from(table).delete().eq('id', id);
  if (table === 'bookings') {
    refreshBookings();
    refreshDashboard();
    return;
  }
  refreshResources();
  refreshBookings();
}

export async function refreshBookings() {
  const listElement = document.getElementById('list-bookings');
  if (!listElement) {
    return;
  }

  listElement.innerHTML = '<small class="text-muted">Loading...</small>';

  try {
    const client = getClient();
    const { data } = await client.from('bookings').select('*').order('created_at', { ascending: false });

    if (!data || !data.length) {
      listElement.innerHTML = '<small class="text-muted">No bookings.</small>';
      return;
    }

    listElement.innerHTML = data
      .map((booking) => {
        const meetAction = booking.meetlink
          ? `<a href="${escapeHtml(
              booking.meetlink
            )}" target="_blank" rel="noreferrer" class="btn btn-sm btn-success fw-bold" style="font-size:0.7rem"><i class="bi bi-camera-video"></i> Meet</a>`
          : `<button class="btn btn-sm btn-outline-dark" style="font-size:0.7rem" onclick="confirmBooking('${
              booking.id
            }','${escapeHtml(booking.name)}','${escapeHtml(booking.email)}','${escapeHtml(
              booking.topic
            )}','${booking.schedule}')"><i class="bi bi-check-lg"></i> Confirm</button>`;

        return `<div class="border-bottom py-2 small"><div class="d-flex justify-content-between align-items-center"><div><strong>${escapeHtml(
          booking.name
        )}</strong> <span class="badge bg-light text-dark border">${escapeHtml(
          booking.topic
        )}</span><div class="text-muted">${formatDate(booking.schedule)} · ${escapeHtml(
          booking.email
        )}</div></div><div class="d-flex flex-column gap-1 text-end">${meetAction}<button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteItem('bookings','${
          booking.id
        }')">Del</button></div></div></div>`;
      })
      .join('');
  } catch {
    listElement.innerHTML = '<small class="text-danger">Error</small>';
  }
}

export async function confirmBooking(id, name, email, topic, schedule) {
  const meetLink = window.prompt(`Enter Meet link for ${name}:`, 'https://meet.google.com/');
  if (!meetLink) {
    return;
  }

  try {
    const client = getClient();
    await client.from('bookings').update({ meetlink: meetLink, status: 'confirmed' }).eq('id', id);
    alert('Confirmed!');
    refreshBookings();
  } catch {
    alert('Failed');
  }
}

export async function refreshTestimonials() {
  const listElement = document.getElementById('list-testimonials');
  if (!listElement) {
    return;
  }

  try {
    const client = getClient();
    const { data } = await client.from('testimonials').select('*').order('display_order');
    listElement.innerHTML = data && data.length
      ? data
          .map(
            (testimonial) =>
              `<div class="d-flex justify-content-between border-bottom py-2 small"><div><strong>${escapeHtml(
                testimonial.name
              )}</strong> ${'&#9733;'.repeat(testimonial.rating)}<div class="text-muted">${escapeHtml(
                testimonial.content
              ).substring(0, 60)}...</div></div><div><button class="btn btn-link p-0 me-2" onclick="editTestimonial(${JSON.stringify(
                testimonial
              ).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteTestimonial('${
                testimonial.id
              }')">Del</button></div></div>`
          )
          .join('')
      : '<small class="text-muted">No testimonials.</small>';
  } catch {
  }
}

export async function saveTestimonial(event) {
  event.preventDefault();
  const id = document.getElementById('testi-id').value;
  const payload = {
    name: document.getElementById('testi-name').value,
    role: document.getElementById('testi-role').value,
    content: document.getElementById('testi-content').value,
    rating: Number.parseInt(document.getElementById('testi-rating').value, 10),
  };

  try {
    const client = getClient();
    const { error } = id
      ? await client.from('testimonials').update(payload).eq('id', id)
      : await client.from('testimonials').insert([payload]);
    if (error) {
      throw error;
    }
    document.getElementById('testi-id').value = '';
    event.target.reset();
    refreshTestimonials();
  } catch (error) {
    alert(`Failed: ${error.message}`);
  }
}

export function editTestimonial(testimonial) {
  document.getElementById('testi-id').value = testimonial.id;
  document.getElementById('testi-name').value = testimonial.name;
  document.getElementById('testi-role').value = testimonial.role || '';
  document.getElementById('testi-content').value = testimonial.content;
  document.getElementById('testi-rating').value = testimonial.rating;
}

export async function deleteTestimonial(id) {
  if (!window.confirm('Delete?')) {
    return;
  }

  const client = getClient();
  await client.from('testimonials').delete().eq('id', id);
  refreshTestimonials();
}

export async function refreshMessages() {
  const listElement = document.getElementById('list-messages');
  if (!listElement) {
    return;
  }

  try {
    const client = getClient();
    const { data } = await client
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    listElement.innerHTML = data && data.length
      ? data
          .map(
            (message) =>
              `<div class="border-bottom py-2 small ${message.is_read ? '' : 'fw-bold'}"><div class="d-flex justify-content-between"><div><strong>${escapeHtml(
                message.name
              )}</strong> <span class="text-muted">${escapeHtml(message.email)}</span><div>${escapeHtml(
                message.message
              )}</div><div class="text-muted" style="font-size:0.7rem">${formatDate(
                message.created_at
              )}</div></div><div><button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteMessage('${
                message.id
              }')">Del</button></div></div></div>`
          )
          .join('')
      : '<small class="text-muted">No messages.</small>';
  } catch {
  }
}

export async function deleteMessage(id) {
  if (!window.confirm('Delete?')) {
    return;
  }

  const client = getClient();
  await client.from('contact_messages').delete().eq('id', id);
  refreshMessages();
}

export async function loadAnalytics() {
  const analyticsElement = document.getElementById('analytics-data');
  if (!analyticsElement) {
    return;
  }

  try {
    const client = getClient();
    const { data } = await client
      .from('link_clicks')
      .select('link_title, clicked_at')
      .order('clicked_at', { ascending: false })
      .limit(100);

    if (!data || !data.length) {
      analyticsElement.innerHTML = '<small class="text-muted">No click data yet.</small>';
      return;
    }

    const counts = {};
    data.forEach((item) => {
      const title = item.link_title || 'Unknown';
      counts[title] = (counts[title] || 0) + 1;
    });

    const sortedCounts = Object.entries(counts).sort((left, right) => right[1] - left[1]);

    analyticsElement.innerHTML =
      '<h6 class="fw-bold small mb-2">Top Clicked Links (last 100)</h6>' +
      sortedCounts
        .map(([title, count]) => {
          const percentage = Math.round((count / data.length) * 100);
          return `<div class="mb-2"><div class="d-flex justify-content-between small"><span>${escapeHtml(
            title
          )}</span><strong>${count}</strong></div><div class="progress" style="height:6px"><div class="progress-bar bg-dark" style="width:${percentage}%"></div></div></div>`;
        })
        .join('') +
      `<div class="text-muted small mt-3">Total clicks tracked: ${data.length}</div>`;
  } catch {
    analyticsElement.innerHTML = '<small class="text-danger">Error loading analytics.</small>';
  }
}
