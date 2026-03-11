import {
  deleteBooking,
  deleteContactMessage,
  deleteLink as deleteLinkData,
  deleteResource,
  deleteTestimonial as deleteTestimonialData,
  getAllLinks,
  getBookings,
  getContactMessages,
  getDashboardStats,
  getModules,
  getRecentLinkClicks,
  getResources,
  getSiteSettings,
  getTestimonials,
  getVersionInfo,
  saveLink as saveLinkData,
  saveResource as saveResourceData,
  saveTestimonial as saveTestimonialData,
  updateBookingConfirmation,
  updateModuleStatus,
  updateSiteSettings,
} from '../api/data.js';
import {
  escapeHtml,
  formatDate,
  formatErrorMessage,
  invalidateField,
  setButtonBusy,
  setElementState,
  showToast,
} from '../shared/utils.js';

const adminState = {
  currentUser: null,
  version: null,
  modules: [],
  links: [],
  resources: {
    freebies: [],
    gear: [],
  },
  bookings: [],
  testimonials: [],
  messages: [],
};

function getById(id) {
  return document.getElementById(id);
}

function normalizeForCompare(value) {
  return String(value || '').trim().toLowerCase();
}

function setListState(id, title, message, tone = 'muted') {
  setElementState(getById(id), {
    tone,
    title,
    message,
    compact: true,
  });
}

function reportLoadFailure(context, error, id, fallbackTitle) {
  console.error(`${context} failed`, error);
  if (id) {
    setListState(id, fallbackTitle, formatErrorMessage(error), 'error');
  }
}

function updateHeaderContext() {
  const versionElement = getById('deploy-version');
  if (versionElement) {
    if (!adminState.version) {
      versionElement.textContent = 'Version unavailable';
    } else {
      versionElement.textContent = adminState.version.deployMarker
        ? `${adminState.version.version} · ${adminState.version.deployMarker}`
        : adminState.version.version;
      versionElement.title = `Started ${formatDate(adminState.version.startedAt)}`;
    }
  }

  const userElement = getById('admin-user-email');
  if (userElement) {
    userElement.textContent = adminState.currentUser?.email || 'Signed in';
  }
}

function validateLinkPayload(payload, id = '') {
  if (!payload.title) {
    invalidateField('link-title', 'Link title is required.');
  }

  if (!payload.url) {
    invalidateField('link-url', 'Link URL is required.');
  }

  if (payload.link_type === 'internal' && !payload.internal_target) {
    invalidateField('link-internal-target', 'Choose an internal target for internal links.');
  }

  const duplicateTitle = adminState.links.find(
    (item) => item.id !== id && normalizeForCompare(item.title) === normalizeForCompare(payload.title)
  );
  if (duplicateTitle) {
    invalidateField('link-title', 'A link with this title already exists.');
  }

  const duplicateUrl = adminState.links.find(
    (item) => item.id !== id && normalizeForCompare(item.url) === normalizeForCompare(payload.url)
  );
  if (duplicateUrl) {
    invalidateField('link-url', 'A link with this URL already exists.');
  }
}

function validateResourcePayload(table, payload, id = '') {
  if (!payload.title) {
    invalidateField('form-title', 'Title is required.');
  }

  if (!payload.link) {
    invalidateField('form-link', 'Link is required.');
  }

  const existingItems = adminState.resources[table] || [];
  const duplicateTitle = existingItems.find(
    (item) => item.id !== id && normalizeForCompare(item.title) === normalizeForCompare(payload.title)
  );
  if (duplicateTitle) {
    invalidateField('form-title', 'An item with this title already exists.');
  }

  const duplicateUrl = existingItems.find(
    (item) => item.id !== id && normalizeForCompare(item.link) === normalizeForCompare(payload.link)
  );
  if (duplicateUrl) {
    invalidateField('form-link', 'An item with this link already exists.');
  }
}

function validateTestimonialPayload(payload, id = '') {
  if (!payload.name) {
    invalidateField('testi-name', 'Name is required.');
  }

  if (!payload.content) {
    invalidateField('testi-content', 'Testimonial content is required.');
  }

  const duplicateEntry = adminState.testimonials.find(
    (item) =>
      item.id !== id &&
      normalizeForCompare(item.name) === normalizeForCompare(payload.name) &&
      normalizeForCompare(item.content) === normalizeForCompare(payload.content)
  );

  if (duplicateEntry) {
    invalidateField('testi-content', 'This testimonial already exists.');
  }
}

function renderDashboardModules() {
  const dashboardModules = getById('dashboard-active-modules');
  if (!dashboardModules) {
    return;
  }

  const activeModules = adminState.modules.filter((moduleItem) => moduleItem.is_enabled);
  if (!activeModules.length) {
    setListState('dashboard-active-modules', 'No active modules', 'Enable modules to make them live.', 'muted');
    return;
  }

  dashboardModules.innerHTML = activeModules
    .map(
      (moduleItem) =>
        `<div class="d-flex align-items-center small border p-2 rounded bg-light"><i class="bi ${escapeHtml(moduleItem.icon)} me-2 text-primary"></i><span class="fw-bold">${escapeHtml(moduleItem.name)}</span></div>`
    )
    .join('');
}

export function switchAdminTab(button, tabName) {
  document.querySelectorAll('.admin-tab-panel').forEach((panel) => {
    panel.classList.remove('active');
  });
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.classList.remove('active');
  });

  getById(`tab-${tabName}`)?.classList.add('active');
  button?.classList.add('active');
}

export function initAdmin(user = null) {
  if (user) {
    adminState.currentUser = user;
  }

  updateHeaderContext();
  void refreshVersionInfo();
  void refreshDashboard();
  void loadSiteSettingsAdmin();
  void refreshAdminLinks();
  void refreshResources();
  void refreshBookings();
  void refreshModulesAdmin();
}

export async function refreshVersionInfo() {
  try {
    adminState.version = await getVersionInfo();
  } catch (error) {
    console.error('Version lookup failed', error);
    adminState.version = null;
  }

  updateHeaderContext();
}

export async function refreshDashboard() {
  ['stat-links', 'stat-bookings', 'stat-messages', 'stat-clicks'].forEach((id) => {
    const element = getById(id);
    if (element) {
      element.textContent = '...';
    }
  });

  try {
    const stats = await getDashboardStats();
    const statMap = {
      'stat-links': stats.links,
      'stat-bookings': stats.bookings,
      'stat-messages': stats.messages,
      'stat-clicks': stats.clicks,
    };

    Object.entries(statMap).forEach(([id, value]) => {
      const element = getById(id);
      if (element) {
        element.textContent = String(value ?? 0);
      }
    });
  } catch (error) {
    console.error('Dashboard stats failed', error);
    ['stat-links', 'stat-bookings', 'stat-messages', 'stat-clicks'].forEach((id) => {
      const element = getById(id);
      if (element) {
        element.textContent = '!';
      }
    });
  }
}

export async function loadSiteSettingsAdmin() {
  try {
    const data = await getSiteSettings();
    if (!data) {
      return;
    }

    const setValue = (id, value) => {
      const element = getById(id);
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
  } catch (error) {
    reportLoadFailure('Site settings', error);
  }
}

export async function saveSiteSettings() {
  const submitButton = getById('site-settings-save');
  setButtonBusy(submitButton, true, 'Saving settings...');

  const getValue = (id) => getById(id)?.value?.trim() || '';
  const payload = {
    site_name: getValue('set-site-name'),
    headline: getValue('set-headline'),
    subheadline: getValue('set-subheadline'),
    footer_text: getValue('set-footer'),
    cta_title: getValue('set-cta-title'),
    cta_subtitle: getValue('set-cta-subtitle'),
    cta_button_text: getValue('set-cta-button'),
    logo_type: getValue('set-logo-type'),
    logo_svg: getById('set-logo-svg')?.value || '',
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
    await updateSiteSettings(payload);
    showToast('Site settings are live.', {
      tone: 'success',
      title: 'Saved',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to save site settings.'), {
      tone: 'error',
      title: 'Save failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export function toggleLogoFields() {
  const typeSelector = getById('set-logo-type');
  if (!typeSelector) {
    return;
  }

  ['logo-svg-field', 'logo-image-field', 'logo-emoji-field'].forEach((id) => {
    const element = getById(id);
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
    const element = getById(targetField);
    if (element) {
      element.style.display = '';
    }
  }
}

export async function refreshModulesAdmin() {
  setListState('module-list', 'Loading modules', 'Checking feature toggles...');
  setListState('dashboard-active-modules', 'Loading modules', 'Fetching enabled sections...');

  try {
    const data = await getModules();
    adminState.modules = data || [];

    const container = getById('module-list');
    if (container) {
      if (!adminState.modules.length) {
        setListState('module-list', 'No modules found', 'Seed your modules table to continue.');
      } else {
        container.innerHTML = adminState.modules
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
      }
    }

    renderDashboardModules();

    adminState.modules.forEach((moduleItem) => {
      const panel = getById(`mod-${moduleItem.slug}`);
      if (panel) {
        panel.style.display = moduleItem.is_enabled ? '' : 'none';
      }
    });

    if (adminState.modules.find((moduleItem) => moduleItem.slug === 'testimonials' && moduleItem.is_enabled)) {
      void refreshTestimonials();
    }
    if (adminState.modules.find((moduleItem) => moduleItem.slug === 'contact' && moduleItem.is_enabled)) {
      void refreshMessages();
    }
    if (adminState.modules.find((moduleItem) => moduleItem.slug === 'analytics' && moduleItem.is_enabled)) {
      void loadAnalytics();
    }
  } catch (error) {
    reportLoadFailure('Modules', error, 'module-list', 'Modules unavailable');
    reportLoadFailure('Dashboard modules', error, 'dashboard-active-modules', 'Modules unavailable');
  }
}

export async function toggleModule(slug, enabled) {
  try {
    await updateModuleStatus(slug, enabled);
    showToast(`Module ${enabled ? 'enabled' : 'disabled'} successfully.`, {
      tone: 'success',
      title: 'Module updated',
    });
    await refreshModulesAdmin();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to update the module right now.'), {
      tone: 'error',
      title: 'Module update failed',
    });
  }
}

export async function refreshAdminLinks() {
  setListState('list-links', 'Loading links', 'Pulling your homepage links...');

  try {
    const data = await getAllLinks();
    adminState.links = data || [];

    const listElement = getById('list-links');
    if (!listElement) {
      return;
    }

    listElement.innerHTML = adminState.links.length
      ? adminState.links
          .map((link) => {
            const badge = link.is_active
              ? '<span class="badge bg-success" style="font-size:0.6rem">ON</span>'
              : '<span class="badge bg-secondary" style="font-size:0.6rem">OFF</span>';
            const typeIcon = link.link_type === 'external' ? 'bi-box-arrow-up-right' : 'bi-folder2-open';
            return `<div class="d-flex justify-content-between align-items-center border-bottom py-2 small"><div><i class="bi ${typeIcon} me-1"></i><strong>${escapeHtml(link.title)}</strong> ${badge}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(link.url)}</div></div><div><button class="btn btn-link p-0 me-2" onclick='editLink(${JSON.stringify(link).replace(/'/g, '&#39;')})'>Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteLink('${link.id}')">Delete</button></div></div>`;
          })
          .join('')
      : '';

    if (!adminState.links.length) {
      setListState('list-links', 'No links yet', 'Add your first homepage link to get started.');
    }
  } catch (error) {
    reportLoadFailure('Links', error, 'list-links', 'Links unavailable');
  }
}

export async function saveLink(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Saving link...');

  const id = getById('link-id')?.value || '';
  const payload = {
    title: getById('link-title')?.value?.trim() || '',
    url: getById('link-url')?.value?.trim() || '',
    icon: getById('link-icon')?.value?.trim() || 'bi-link-45deg',
    link_type: getById('link-type')?.value || 'external',
    internal_target: getById('link-internal-target')?.value || null,
    style_bg: getById('link-style-bg')?.value?.trim() || null,
    display_order: Number.parseInt(getById('link-order')?.value || '0', 10) || 0,
    is_active: Boolean(getById('link-active')?.checked),
  };

  try {
    validateLinkPayload(payload, id);
    await saveLinkData(id || null, payload);
    resetLinkForm();
    event.target.reset();
    getById('link-active').checked = true;
    getById('link-type').value = 'external';
    toggleInternalFields();
    await refreshAdminLinks();
    await refreshDashboard();
    showToast(`Link ${id ? 'updated' : 'created'} successfully.`, {
      tone: 'success',
      title: 'Links saved',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to save the link right now.'), {
      tone: 'error',
      title: 'Link save failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export function editLink(link) {
  getById('link-id').value = link.id;
  getById('link-title').value = link.title;
  getById('link-url').value = link.url;
  getById('link-icon').value = link.icon || '';
  getById('link-type').value = link.link_type || 'external';
  getById('link-internal-target').value = link.internal_target || '';
  getById('link-style-bg').value = link.style_bg || '';
  getById('link-order').value = link.display_order || 0;
  getById('link-active').checked = link.is_active;
  toggleInternalFields();
  getById('link-title').focus();
}

export async function deleteLink(id) {
  if (!window.confirm('Delete this link?')) {
    return;
  }

  try {
    await deleteLinkData(id);
    await refreshAdminLinks();
    await refreshDashboard();
    showToast('Link deleted.', {
      tone: 'success',
      title: 'Link removed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to delete the link right now.'), {
      tone: 'error',
      title: 'Delete failed',
    });
  }
}

export function resetLinkForm() {
  getById('link-id').value = '';
  getById('link-active').checked = true;
}

export function toggleInternalFields() {
  const fields = getById('internal-fields');
  if (fields) {
    fields.style.display = getById('link-type')?.value === 'internal' ? '' : 'none';
  }
}

async function refreshResourceTable(table) {
  setListState(`list-${table}`, `Loading ${table}`, 'Fetching latest entries...');

  const data = await getResources(table);
  adminState.resources[table] = data || [];
  const listElement = getById(`list-${table}`);
  if (!listElement) {
    return;
  }

  listElement.innerHTML = adminState.resources[table].length
    ? adminState.resources[table]
        .map(
          (item) =>
            `<div class="d-flex justify-content-between border-bottom py-2 small"><span>${escapeHtml(item.title)}</span><div><button class="btn btn-link p-0 me-2" onclick="editItem('${table}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteItem('${table}','${item.id}')">Delete</button></div></div>`
        )
        .join('')
    : '';

  if (!adminState.resources[table].length) {
    setListState(`list-${table}`, `No ${table} yet`, 'Add an item to populate this list.');
  }
}

export async function refreshResources() {
  try {
    await refreshResourceTable('freebies');
    await refreshResourceTable('gear');
  } catch (error) {
    reportLoadFailure('Resources', error, 'list-freebies', 'Resources unavailable');
    reportLoadFailure('Resources', error, 'list-gear', 'Resources unavailable');
  }
}

export async function saveResource(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Saving resource...');

  const table = (getById('form-sheet')?.value || 'Freebies').toLowerCase();
  const id = getById('form-id')?.value || '';
  const payload = {
    title: getById('form-title')?.value?.trim() || '',
    link: getById('form-link')?.value?.trim() || '',
    display_order: 0,
  };

  if (table === 'freebies') {
    payload.description = getById('form-extra')?.value?.trim() || '';
  } else {
    payload.category = getById('form-extra')?.value?.trim() || '';
  }

  try {
    validateResourcePayload(table, payload, id);
    await saveResourceData(table, id || null, payload);
    getById('form-id').value = '';
    event.target.reset();
    await refreshResources();
    showToast(`${table === 'freebies' ? 'Freebie' : 'Gear item'} ${id ? 'updated' : 'saved'} successfully.`, {
      tone: 'success',
      title: 'Resource saved',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to save the resource right now.'), {
      tone: 'error',
      title: 'Resource save failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export function editItem(table, item) {
  getById('form-sheet').value = table.charAt(0).toUpperCase() + table.slice(1);
  getById('form-id').value = item.id;
  getById('form-title').value = item.title;
  getById('form-link').value = item.link;
  getById('form-extra').value = item.description || item.category || '';
}

export async function deleteItem(table, id) {
  if (!window.confirm(`Delete this ${table === 'bookings' ? 'booking' : 'item'}?`)) {
    return;
  }

  try {
    if (table === 'bookings') {
      await deleteBooking(id);
      await refreshBookings();
      await refreshDashboard();
      showToast('Booking deleted.', {
        tone: 'success',
        title: 'Booking removed',
      });
      return;
    }

    await deleteResource(table, id);
    await refreshResources();
    showToast('Resource deleted.', {
      tone: 'success',
      title: 'Resource removed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to delete the item right now.'), {
      tone: 'error',
      title: 'Delete failed',
    });
  }
}

export async function refreshBookings() {
  setListState('list-bookings', 'Loading bookings', 'Checking incoming consultation requests...');

  try {
    const data = await getBookings();
    adminState.bookings = data || [];
    const listElement = getById('list-bookings');
    if (!listElement) {
      return;
    }

    if (!adminState.bookings.length) {
      setListState('list-bookings', 'No bookings yet', 'New consultations will show up here.');
      return;
    }

    listElement.innerHTML = adminState.bookings
      .map((booking) => {
        const meetAction = booking.meetlink
          ? `<a href="${escapeHtml(booking.meetlink)}" target="_blank" rel="noreferrer" class="btn btn-sm btn-success fw-bold" style="font-size:0.7rem"><i class="bi bi-camera-video"></i> Meet</a>`
          : `<button class="btn btn-sm btn-outline-dark" style="font-size:0.7rem" onclick="confirmBooking('${booking.id}','${escapeHtml(booking.name)}')"><i class="bi bi-check-lg"></i> Confirm</button>`;

        return `<div class="border-bottom py-2 small"><div class="d-flex justify-content-between align-items-center"><div><strong>${escapeHtml(booking.name)}</strong> <span class="badge bg-light text-dark border">${escapeHtml(booking.topic)}</span><div class="text-muted">${formatDate(booking.schedule)} · ${escapeHtml(booking.email)}</div></div><div class="d-flex flex-column gap-1 text-end">${meetAction}<button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteItem('bookings','${booking.id}')">Delete</button></div></div></div>`;
      })
      .join('');
  } catch (error) {
    reportLoadFailure('Bookings', error, 'list-bookings', 'Bookings unavailable');
  }
}

export async function confirmBooking(id, name) {
  const meetLink = window.prompt(`Enter Meet link for ${name}:`, 'https://meet.google.com/');
  if (!meetLink) {
    return;
  }

  try {
    await updateBookingConfirmation(id, meetLink.trim());
    await refreshBookings();
    await refreshDashboard();
    showToast('Booking confirmed and meet link saved.', {
      tone: 'success',
      title: 'Booking confirmed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to confirm the booking right now.'), {
      tone: 'error',
      title: 'Confirmation failed',
    });
  }
}

export async function refreshTestimonials() {
  setListState('list-testimonials', 'Loading testimonials', 'Fetching social proof from the database...');

  try {
    const data = await getTestimonials();
    adminState.testimonials = data || [];
    const listElement = getById('list-testimonials');
    if (!listElement) {
      return;
    }

    if (!adminState.testimonials.length) {
      setListState('list-testimonials', 'No testimonials yet', 'Saved testimonials will appear here.');
      return;
    }

    listElement.innerHTML = adminState.testimonials
      .map(
        (testimonial) =>
          `<div class="d-flex justify-content-between border-bottom py-2 small"><div><strong>${escapeHtml(testimonial.name)}</strong> ${'&#9733;'.repeat(testimonial.rating)}<div class="text-muted">${escapeHtml(testimonial.content).substring(0, 80)}...</div></div><div><button class="btn btn-link p-0 me-2" onclick="editTestimonial(${JSON.stringify(testimonial).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-link text-danger p-0" onclick="deleteTestimonial('${testimonial.id}')">Delete</button></div></div>`
      )
      .join('');
  } catch (error) {
    reportLoadFailure('Testimonials', error, 'list-testimonials', 'Testimonials unavailable');
  }
}

export async function saveTestimonial(event) {
  event.preventDefault();
  const submitButton = event.target.querySelector('button[type="submit"]');
  setButtonBusy(submitButton, true, 'Saving testimonial...');

  const id = getById('testi-id')?.value || '';
  const payload = {
    name: getById('testi-name')?.value?.trim() || '',
    role: getById('testi-role')?.value?.trim() || '',
    content: getById('testi-content')?.value?.trim() || '',
    rating: Number.parseInt(getById('testi-rating')?.value || '5', 10),
    is_featured: true,
    display_order: 0,
  };

  try {
    validateTestimonialPayload(payload, id);
    await saveTestimonialData(id || null, payload);
    getById('testi-id').value = '';
    event.target.reset();
    await refreshTestimonials();
    showToast(`Testimonial ${id ? 'updated' : 'saved'} successfully.`, {
      tone: 'success',
      title: 'Testimonial saved',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to save the testimonial right now.'), {
      tone: 'error',
      title: 'Testimonial save failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export function editTestimonial(testimonial) {
  getById('testi-id').value = testimonial.id;
  getById('testi-name').value = testimonial.name;
  getById('testi-role').value = testimonial.role || '';
  getById('testi-content').value = testimonial.content;
  getById('testi-rating').value = testimonial.rating;
}

export async function deleteTestimonial(id) {
  if (!window.confirm('Delete this testimonial?')) {
    return;
  }

  try {
    await deleteTestimonialData(id);
    await refreshTestimonials();
    showToast('Testimonial deleted.', {
      tone: 'success',
      title: 'Testimonial removed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to delete the testimonial right now.'), {
      tone: 'error',
      title: 'Delete failed',
    });
  }
}

export async function refreshMessages() {
  setListState('list-messages', 'Loading messages', 'Fetching contact inbox...');

  try {
    const data = await getContactMessages();
    adminState.messages = data || [];
    const listElement = getById('list-messages');
    if (!listElement) {
      return;
    }

    if (!adminState.messages.length) {
      setListState('list-messages', 'Inbox is clear', 'New messages will show up here.');
      return;
    }

    listElement.innerHTML = adminState.messages
      .map(
        (message) =>
          `<div class="border-bottom py-2 small ${message.is_read ? '' : 'fw-bold'}"><div class="d-flex justify-content-between"><div><strong>${escapeHtml(message.name)}</strong> <span class="text-muted">${escapeHtml(message.email)}</span><div>${escapeHtml(message.message)}</div><div class="text-muted" style="font-size:0.7rem">${formatDate(message.created_at)}</div></div><div><button class="btn btn-link text-danger p-0" style="font-size:0.7rem" onclick="deleteMessage('${message.id}')">Delete</button></div></div></div>`
      )
      .join('');
  } catch (error) {
    reportLoadFailure('Messages', error, 'list-messages', 'Messages unavailable');
  }
}

export async function deleteMessage(id) {
  if (!window.confirm('Delete this message?')) {
    return;
  }

  try {
    await deleteContactMessage(id);
    await refreshMessages();
    await refreshDashboard();
    showToast('Message deleted.', {
      tone: 'success',
      title: 'Message removed',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to delete the message right now.'), {
      tone: 'error',
      title: 'Delete failed',
    });
  }
}

export async function loadAnalytics() {
  setListState('analytics-data', 'Loading analytics', 'Summarising your recent link clicks...');

  try {
    const data = await getRecentLinkClicks();
    const analyticsElement = getById('analytics-data');
    if (!analyticsElement) {
      return;
    }

    if (!data || !data.length) {
      setListState('analytics-data', 'No click data yet', 'Analytics will populate once visitors start clicking links.');
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
          return `<div class="mb-2"><div class="d-flex justify-content-between small"><span>${escapeHtml(title)}</span><strong>${count}</strong></div><div class="progress" style="height:6px"><div class="progress-bar bg-dark" style="width:${percentage}%"></div></div></div>`;
        })
        .join('') +
      `<div class="text-muted small mt-3">Total clicks tracked: ${data.length}</div>`;
  } catch (error) {
    reportLoadFailure('Analytics', error, 'analytics-data', 'Analytics unavailable');
  }
}
