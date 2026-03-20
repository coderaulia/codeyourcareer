import {
  completeSetup,
  deleteBackup,
  deleteBooking,
  deleteContactMessage,
  deleteLink as deleteLinkData,
  deleteResource,
  deleteTestimonial as deleteTestimonialData,
  downloadAnalyticsExport,
  getAllLinks,
  getBackupDownloadUrl,
  getBookings,
  getContactMessages,
  getAnalyticsOverview,
  getDashboardStats,
  getModules,
  getResources,
  getSetupStatus,
  getSiteSettings,
  getTestimonials,
  getVersionInfo,
  listBackups,
  reorderCollection,
  runCleanup,
  saveLink as saveLinkData,
  saveResource as saveResourceData,
  saveTestimonial as saveTestimonialData,
  setContactMessageRead,
  updateBookingConfirmation,
  updateBookingStatus,
  updateModuleStatus,
  updateSiteSettings,
  uploadImage,
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
  analyticsOverview: null,
  links: [],
  resources: {
    freebies: [],
    gear: [],
  },
  bookings: [],
  testimonials: [],
  messages: [],
};

const DEFAULT_LINK_BG = '#f1f3f5';

function getById(id) {
  return document.getElementById(id);
}

function normalizeHexColor(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return '#' + trimmed.slice(1).split('').map((character) => character + character).join('').toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return '';
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
        ? `${adminState.version.version} - ${adminState.version.deployMarker}`
        : adminState.version.version;
      versionElement.title = `Started ${formatDate(adminState.version.startedAt)}`;
    }
  }

  const userElement = getById('admin-user-email');
  if (userElement) {
    userElement.textContent = adminState.currentUser?.email || 'Signed in';
  }
}

function formatSignedValue(value, suffix = '') {
  const numericValue = Number(value || 0);
  const sign = numericValue > 0 ? '+' : '';
  return `${sign}${numericValue}${suffix}`;
}

function formatTrendDay(value) {
  if (!value) {
    return '';
  }

  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function renderAnalyticsComparisons(items) {
  if (!items?.length) {
    return '<div class="text-muted small">Period comparison data is not available yet.</div>';
  }

  return items
    .map((item) => {
      const toneClass =
        item.tone === 'positive'
          ? 'analytics-kpi-positive'
          : item.tone === 'negative'
            ? 'analytics-kpi-negative'
            : 'analytics-kpi-neutral';
      const valueSuffix = item.suffix || '';
      return `
        <div class="analytics-kpi ${toneClass}">
          <div class="analytics-kpi__label">${escapeHtml(item.label)}</div>
          <div class="analytics-kpi__value">${item.current}${escapeHtml(valueSuffix)}</div>
          <div class="analytics-kpi__meta">
            <span>${formatSignedValue(item.delta, valueSuffix)} vs prev.</span>
            <span>${formatSignedValue(item.percentChange, '%')}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAnalyticsAlerts(items) {
  if (!items?.length) {
    return '<div class="text-muted small">No alert data yet.</div>';
  }

  return items
    .map((item) => {
      const toneClass =
        item.tone === 'positive'
          ? 'analytics-alert-positive'
          : item.tone === 'negative'
            ? 'analytics-alert-negative'
            : 'analytics-alert-neutral';
      return `
        <div class="analytics-alert ${toneClass}">
          <div class="analytics-alert__title">${escapeHtml(item.label)}</div>
          <div class="analytics-alert__message">${escapeHtml(item.message)}</div>
        </div>
      `;
    })
    .join('');
}

function renderAnalyticsBreakdown(items, emptyMessage) {
  if (!items?.length) {
    return `<div class="text-muted small">${escapeHtml(emptyMessage)}</div>`;
  }

  return items
    .map(
      (item) => `
        <div class="analytics-breakdown__row">
          <div class="d-flex justify-content-between gap-2 small">
            <span>${escapeHtml(item.label)}</span>
            <strong>${item.count} <span class="text-muted">(${item.percent}%)</span></strong>
          </div>
          <div class="progress analytics-progress">
            <div class="progress-bar bg-dark" style="width:${Math.max(4, Number(item.percent || 0))}%"></div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderDailyTrend(rows) {
  if (!rows?.length) {
    return '<div class="text-muted small">Daily trend data will appear after more traffic is recorded.</div>';
  }

  const visibleRows = rows.slice(-14);
  const maxVisits = Math.max(...visibleRows.map((item) => Number(item.visits || 0)), 1);

  return `
    <div class="analytics-trend-list">
      ${visibleRows
        .map(
          (item) => `
            <div class="analytics-trend-row">
              <div class="analytics-trend-row__day">${escapeHtml(formatTrendDay(item.day))}</div>
              <div class="analytics-trend-row__bar">
                <div class="analytics-trend-row__fill" style="width:${Math.max(4, Math.round((Number(item.visits || 0) / maxVisits) * 100))}%"></div>
              </div>
              <div class="analytics-trend-row__stats">
                <span>${item.visits} visits</span>
                <span>${item.trackedClicks} clicks</span>
                <span>${item.leads} leads</span>
              </div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderContentMomentum(items) {
  if (!items?.length) {
    return '<div class="text-muted small">Content momentum will appear once the current and previous periods have enough clicks.</div>';
  }

  return items
    .map((item) => {
      const badge = item.type === 'resource_click' ? 'Resource' : 'Link';
      const trendClass =
        item.percentChange > 0
          ? 'analytics-delta-positive'
          : item.percentChange < 0
            ? 'analytics-delta-negative'
            : 'analytics-delta-neutral';
      return `
        <div class="analytics-momentum-row">
          <div>
            <div class="fw-bold">${escapeHtml(item.label)} <span class="badge bg-light text-dark border">${badge}</span></div>
            <div class="small text-muted">${item.currentClicks} current / ${item.previousClicks} previous</div>
          </div>
          <div class="analytics-delta ${trendClass}">${formatSignedValue(item.percentChange, '%')}</div>
        </div>
      `;
    })
    .join('');
}

function renderClientReport(report) {
  if (!report) {
    return '<div class="text-muted small">Client summary is unavailable.</div>';
  }

  return `
    <div class="analytics-report-card">
      <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div class="small text-muted">Client-ready summary</div>
          <div class="fw-bold">${escapeHtml(report.headline || '')}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-dark" data-action="copy-analytics-report">Copy Summary</button>
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="analytics-report-section">
            <div class="analytics-report-section__title">Wins</div>
            ${(report.wins || [])
              .map((item) => `<div class="analytics-report-section__item">${escapeHtml(item)}</div>`)
              .join('')}
          </div>
        </div>
        <div class="col-md-6">
          <div class="analytics-report-section">
            <div class="analytics-report-section__title">Watchouts</div>
            ${(report.watchouts || [])
              .map((item) => `<div class="analytics-report-section__item">${escapeHtml(item)}</div>`)
              .join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function validateLinkPayload(payload, id = '') {
  if (!payload.title) {
    invalidateField('link-title', 'Link title is required.');
  }

  if (payload.link_type === 'external' && !payload.url) {
    invalidateField('link-url', 'Link URL is required for external links.');
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

function renderMoveButtons(collection, id, index, total) {
  return `<div class="admin-order-actions"><button class="btn btn-link p-0 ${index === 0 ? 'disabled' : ''}" ${index === 0 ? 'disabled' : ''} type="button" data-action="move-collection" data-collection="${collection}" data-id="${id}" data-direction="up" title="Move up"><i class="bi bi-arrow-up"></i></button><button class="btn btn-link p-0 ${index === total - 1 ? 'disabled' : ''}" ${index === total - 1 ? 'disabled' : ''} type="button" data-action="move-collection" data-collection="${collection}" data-id="${id}" data-direction="down" title="Move down"><i class="bi bi-arrow-down"></i></button></div>`;
}

function getCollectionItems(collection) {
  if (collection === 'links') {
    return adminState.links;
  }

  if (collection === 'freebies' || collection === 'gear') {
    return adminState.resources[collection];
  }

  if (collection === 'testimonials') {
    return adminState.testimonials;
  }

  return [];
}

function findLinkById(id) {
  return adminState.links.find((item) => item.id === id) || null;
}

function findResourceById(table, id) {
  return (adminState.resources[table] || []).find((item) => item.id === id) || null;
}

function findBookingById(id) {
  return adminState.bookings.find((item) => item.id === id) || null;
}

function findTestimonialById(id) {
  return adminState.testimonials.find((item) => item.id === id) || null;
}

function resolveResourcePayload(table, id = '') {
  const existingItem = (adminState.resources[table] || []).find((item) => item.id === id);
  return {
    title: getById('form-title')?.value?.trim() || '',
    link: getById('form-link')?.value?.trim() || '',
    image_url: getById('form-image')?.value?.trim() || null,
    display_order: existingItem?.display_order ?? (adminState.resources[table]?.length || 0),
  };
}

function resolveTestimonialPayload(id = '') {
  const existingItem = adminState.testimonials.find((item) => item.id === id);
  return {
    name: getById('testi-name')?.value?.trim() || '',
    role: getById('testi-role')?.value?.trim() || '',
    content: getById('testi-content')?.value?.trim() || '',
    rating: Number.parseInt(getById('testi-rating')?.value || '5', 10),
    image_url: getById('testi-image')?.value?.trim() || null,
    is_featured: true,
    display_order: existingItem?.display_order ?? adminState.testimonials.length,
  };
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
            (moduleItem) => `<div class="module-toggle-card ${moduleItem.is_enabled ? 'enabled' : ''}"><div><i class="bi ${escapeHtml(moduleItem.icon)} me-2"></i><strong>${escapeHtml(moduleItem.name)}</strong><div class="text-muted small">${escapeHtml(moduleItem.description || '')}</div></div><label class="toggle-switch"><input type="checkbox" ${moduleItem.is_enabled ? 'checked' : ''} data-action="toggle-module" data-slug="${escapeHtml(moduleItem.slug)}"><span class="toggle-slider"></span></label></div>`
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
          .map((link, index) => {
            const badge = link.is_active
              ? '<span class="badge bg-success" style="font-size:0.6rem">ON</span>'
              : '<span class="badge bg-secondary" style="font-size:0.6rem">OFF</span>';
            const typeIcon = link.link_type === 'external' ? 'bi-box-arrow-up-right' : 'bi-folder2-open';
            const subtitle = link.link_type === 'internal' ? `${link.internal_target || 'internal'} - ${link.url}` : link.url;
            return `<div class="admin-list-row"><div class="admin-list-main">${renderMoveButtons('links', link.id, index, adminState.links.length)}<div><i class="bi ${typeIcon} me-1"></i><strong>${escapeHtml(link.title)}</strong> ${badge}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(subtitle || '')}</div></div></div><div class="admin-list-actions"><button class="btn btn-link p-0 me-2" type="button" data-action="edit-link" data-id="${link.id}">Edit</button><button class="btn btn-link text-danger p-0" type="button" data-action="delete-link" data-id="${link.id}">Delete</button></div></div>`;
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
  const linkType = getById('link-type')?.value || 'external';
  const internalTarget = getById('link-internal-target')?.value || null;
  const payload = {
    title: getById('link-title')?.value?.trim() || '',
    url:
      linkType === 'internal'
        ? `#${internalTarget || ''}`
        : getById('link-url')?.value?.trim() || '',
    icon: getById('link-icon')?.value?.trim() || 'bi-link-45deg',
    link_type: linkType,
    internal_target: internalTarget,
    style_bg: linkType === 'internal' ? normalizeHexColor(getById('link-style-bg')?.value) || null : null,
    display_order: Number.parseInt(getById('link-order')?.value || '0', 10) || 0,
    is_active: Boolean(getById('link-active')?.checked),
  };

  try {
    validateLinkPayload(payload, id);
    await saveLinkData(id || null, payload);
    resetLinkForm();
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

export function editLink(linkOrId) {
  const link = typeof linkOrId === 'string' ? findLinkById(linkOrId) : linkOrId;
  if (!link) {
    return;
  }

  getById('link-id').value = link.id;
  getById('link-title').value = link.title;
  getById('link-url').value = link.url;
  getById('link-icon').value = link.icon || '';
  getById('link-type').value = link.link_type || 'external';
  getById('link-internal-target').value = link.internal_target || '';
  syncLinkStyleBg(link.style_bg || '');
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

export function syncLinkStyleBg(value, preserveTextInput = false) {
  const picker = getById('link-style-bg-picker');
  const textInput = getById('link-style-bg');
  const rawValue = String(value || '').trim();
  const normalized = normalizeHexColor(rawValue);

  if (textInput && !preserveTextInput) {
    textInput.value = normalized || rawValue;
  }

  if (picker) {
    if (!rawValue) {
      picker.value = DEFAULT_LINK_BG;
    } else if (normalized) {
      picker.value = normalized;
    }
  }
}

export function resetLinkForm() {
  const form = getById('link-form');
  form?.reset();

  getById('link-id').value = '';
  getById('link-type').value = 'external';
  getById('link-internal-target').value = '';
  getById('link-active').checked = true;
  syncLinkStyleBg('');
  toggleInternalFields();
  getById('link-title')?.focus();
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
          (item, index) =>
            `<div class="admin-list-row"><div class="admin-list-main">${renderMoveButtons(table, item.id, index, adminState.resources[table].length)}<div><strong>${escapeHtml(item.title)}</strong>${item.image_url ? ' <span class="badge bg-light text-dark border">Image</span>' : ''}<div class="text-muted" style="font-size:0.7rem">${escapeHtml(item.description || item.category || item.link)}</div></div></div><div class="admin-list-actions"><button class="btn btn-link p-0 me-2" type="button" data-action="edit-resource" data-table="${table}" data-id="${item.id}">Edit</button><button class="btn btn-link text-danger p-0" type="button" data-action="delete-resource" data-table="${table}" data-id="${item.id}">Delete</button></div></div>`
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
  const payload = resolveResourcePayload(table, id);

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
    if (getById('form-image')) {
      getById('form-image').value = '';
    }
    if (getById('form-image-file')) {
      getById('form-image-file').value = '';
    }
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

export function editItem(table, itemOrId) {
  const item = typeof itemOrId === 'string' ? findResourceById(table, itemOrId) : itemOrId;
  if (!item) {
    return;
  }

  getById('form-sheet').value = table.charAt(0).toUpperCase() + table.slice(1);
  getById('form-id').value = item.id;
  getById('form-title').value = item.title;
  getById('form-link').value = item.link;
  getById('form-extra').value = item.description || item.category || '';
  if (getById('form-image')) {
    getById('form-image').value = item.image_url || '';
  }
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

function renderBookingStatusBadge(status) {
  const toneMap = {
    pending: 'bg-warning text-dark',
    confirmed: 'bg-info text-dark',
    completed: 'bg-success',
    cancelled: 'bg-secondary',
    no_show: 'bg-danger',
  };

  return `<span class="badge ${toneMap[status] || 'bg-light text-dark border'}">${escapeHtml((status || 'pending').replace('_', ' '))}</span>`;
}

function renderBookingActions(booking) {
  const actions = [];

  if (booking.status === 'pending') {
    actions.push(`<button class="btn btn-sm btn-outline-dark" type="button" data-action="confirm-booking" data-id="${booking.id}"><i class="bi bi-check-lg"></i> Confirm</button>`);
    actions.push(`<button class="btn btn-sm btn-outline-secondary" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="cancelled">Cancel</button>`);
    actions.push(`<button class="btn btn-sm btn-outline-danger" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="no_show">No show</button>`);
  } else if (booking.status === 'confirmed') {
    if (booking.meetlink) {
      actions.push(`<a href="${escapeHtml(booking.meetlink)}" target="_blank" rel="noreferrer" class="btn btn-sm btn-success"><i class="bi bi-camera-video"></i> Meet</a>`);
    }
    actions.push(`<button class="btn btn-sm btn-outline-success" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="completed">Complete</button>`);
    actions.push(`<button class="btn btn-sm btn-outline-secondary" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="cancelled">Cancel</button>`);
    actions.push(`<button class="btn btn-sm btn-outline-danger" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="no_show">No show</button>`);
  } else {
    actions.push(`<button class="btn btn-sm btn-outline-dark" type="button" data-action="set-booking-status" data-id="${booking.id}" data-status="pending">Set pending</button>`);
  }

  actions.push(`<button class="btn btn-link text-danger p-0" style="font-size:0.75rem" type="button" data-action="delete-booking" data-id="${booking.id}">Delete</button>`);
  return actions.join('');
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
      .map((booking) => `<div class="border-bottom py-2 small"><div class="d-flex justify-content-between align-items-start gap-3"><div><strong>${escapeHtml(booking.name)}</strong> ${renderBookingStatusBadge(booking.status)} <span class="badge bg-light text-dark border">${escapeHtml(booking.topic)}</span><div class="text-muted">${formatDate(booking.schedule)} - ${escapeHtml(booking.email)}</div>${booking.meetlink ? `<div class="text-muted" style="font-size:0.75rem">${escapeHtml(booking.meetlink)}</div>` : ''}</div><div class="d-flex flex-column gap-2 text-end">${renderBookingActions(booking)}</div></div></div>`)
      .join('');
  } catch (error) {
    reportLoadFailure('Bookings', error, 'list-bookings', 'Bookings unavailable');
  }
}

export async function confirmBooking(id, name, currentMeetLink = '') {
  if (!name) {
    const booking = findBookingById(id);
    name = booking?.name || 'this booking';
    currentMeetLink = booking?.meetlink || '';
  }

  const meetLink = window.prompt(`Enter Meet link for ${name}:`, currentMeetLink || 'https://meet.google.com/');
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

export async function setBookingStatusAction(id, status) {
  try {
    await updateBookingStatus(id, status);
    await refreshBookings();
    await refreshDashboard();
    showToast(`Booking moved to ${status.replace('_', ' ')}.`, {
      tone: 'success',
      title: 'Booking updated',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to update the booking right now.'), {
      tone: 'error',
      title: 'Booking update failed',
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
        (testimonial, index) => `<div class="admin-list-row"><div class="admin-list-main">${renderMoveButtons('testimonials', testimonial.id, index, adminState.testimonials.length)}<div><strong>${escapeHtml(testimonial.name)}</strong> ${'&#9733;'.repeat(testimonial.rating)}${testimonial.image_url ? ' <span class="badge bg-light text-dark border">Image</span>' : ''}<div class="text-muted">${escapeHtml(testimonial.content).substring(0, 80)}...</div></div></div><div class="admin-list-actions"><button class="btn btn-link p-0 me-2" type="button" data-action="edit-testimonial" data-id="${testimonial.id}">Edit</button><button class="btn btn-link text-danger p-0" type="button" data-action="delete-testimonial" data-id="${testimonial.id}">Delete</button></div></div>`
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
  const payload = resolveTestimonialPayload(id);

  try {
    validateTestimonialPayload(payload, id);
    await saveTestimonialData(id || null, payload);
    getById('testi-id').value = '';
    event.target.reset();
    if (getById('testi-image')) {
      getById('testi-image').value = '';
    }
    if (getById('testi-image-file')) {
      getById('testi-image-file').value = '';
    }
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

export function editTestimonial(testimonialOrId) {
  const testimonial = typeof testimonialOrId === 'string' ? findTestimonialById(testimonialOrId) : testimonialOrId;
  if (!testimonial) {
    return;
  }

  getById('testi-id').value = testimonial.id;
  getById('testi-name').value = testimonial.name;
  getById('testi-role').value = testimonial.role || '';
  getById('testi-content').value = testimonial.content;
  getById('testi-rating').value = testimonial.rating;
  if (getById('testi-image')) {
    getById('testi-image').value = testimonial.image_url || '';
  }
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
        (message) => `<div class="border-bottom py-2 small ${message.is_read ? '' : 'fw-bold'}"><div class="d-flex justify-content-between gap-3"><div><strong>${escapeHtml(message.name)}</strong> <span class="text-muted">${escapeHtml(message.email)}</span>${message.is_read ? ' <span class="badge bg-light text-dark border">Read</span>' : ' <span class="badge bg-warning text-dark">Unread</span>'}<div>${escapeHtml(message.message)}</div><div class="text-muted" style="font-size:0.7rem">${formatDate(message.created_at)}</div></div><div class="d-flex flex-column align-items-end gap-2"><button class="btn btn-link p-0" type="button" data-action="toggle-message-read" data-id="${message.id}" data-next-state="${message.is_read ? 'false' : 'true'}">${message.is_read ? 'Mark unread' : 'Mark read'}</button><button class="btn btn-link text-danger p-0" type="button" data-action="delete-message" data-id="${message.id}">Delete</button></div></div></div>`
      )
      .join('');
  } catch (error) {
    reportLoadFailure('Messages', error, 'list-messages', 'Messages unavailable');
  }
}

export async function toggleMessageRead(id, nextState) {
  try {
    await setContactMessageRead(id, nextState);
    await refreshMessages();
    await refreshDashboard();
    showToast(`Message marked as ${nextState ? 'read' : 'unread'}.`, {
      tone: 'success',
      title: 'Inbox updated',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to update the message right now.'), {
      tone: 'error',
      title: 'Message update failed',
    });
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
  const days = Number.parseInt(getById('analytics-range')?.value || '30', 10) || 30;
  setListState('analytics-data', 'Loading analytics', 'Building your traffic and conversion report...');
  adminState.analyticsOverview = null;

  try {
    const data = await getAnalyticsOverview(days);
    adminState.analyticsOverview = data;
    const analyticsElement = getById('analytics-data');
    if (!analyticsElement) {
      return;
    }

    const summary = data?.summary;
    if (!summary) {
      setListState('analytics-data', 'No analytics yet', 'Traffic insights will appear once visitors start engaging.');
      return;
    }

    const totalClicks = Number(summary.linkClicks || 0) + Number(summary.resourceClicks || 0);
    const topSourceMax = Math.max(...(data.topSources || []).map((item) => Number(item.sessions || 0)), 1);
    const topContentMax = Math.max(...(data.contentClicks || []).map((item) => Number(item.clicks || 0)), 1);

    analyticsElement.innerHTML = `
      <div class="row g-3 mb-4">
        <div class="col-md-3 col-6"><div class="p-3 border rounded bg-light"><div class="small text-muted">Visits</div><div class="fs-4 fw-bold">${summary.visits}</div></div></div>
        <div class="col-md-3 col-6"><div class="p-3 border rounded bg-light"><div class="small text-muted">Page Views</div><div class="fs-4 fw-bold">${summary.pageViews}</div></div></div>
        <div class="col-md-3 col-6"><div class="p-3 border rounded bg-light"><div class="small text-muted">Tracked Clicks</div><div class="fs-4 fw-bold">${totalClicks}</div><div class="small text-muted">${summary.linkClicks} links / ${summary.resourceClicks} resources</div></div></div>
        <div class="col-md-3 col-6"><div class="p-3 border rounded bg-light"><div class="small text-muted">Leads</div><div class="fs-4 fw-bold">${summary.leads}</div><div class="small text-muted">${summary.bookings} bookings / ${summary.contacts} contacts</div></div></div>
      </div>
      <div class="p-3 border rounded mb-4">
        <div class="small text-muted mb-1">Conversion Rate</div>
        <div class="fs-3 fw-bold">${summary.conversionRate}%</div>
        <div class="small text-muted">Based on visits tracked in the last ${escapeHtml(String(data.rangeDays || days))} days.</div>
      </div>
      <div class="analytics-alert-grid mb-4">
        ${renderAnalyticsAlerts(data.anomalyAlerts || [])}
      </div>
      <div class="mb-4">
        ${renderClientReport(data.clientReport)}
      </div>
      <div class="analytics-kpi-grid mb-4">
        ${renderAnalyticsComparisons(data.periodComparisons || [])}
      </div>
      <div class="row g-4">
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Top Traffic Sources</h6>
          ${(data.topSources || []).length
            ? data.topSources
                .map((item) => {
                  const width = Math.max(6, Math.round((Number(item.sessions || 0) / topSourceMax) * 100));
                  return `<div class="mb-3"><div class="d-flex justify-content-between small gap-2"><span><strong>${escapeHtml(item.source)}</strong> <span class="text-muted">/ ${escapeHtml(item.medium)}</span></span><span>${item.sessions} visits - ${item.leads} leads</span></div><div class="progress" style="height:6px"><div class="progress-bar bg-dark" style="width:${width}%"></div></div><div class="small text-muted mt-1">${item.conversionRate}% conversion</div></div>`;
                })
                .join('')
            : '<div class="text-muted small">No sources tracked yet.</div>'}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Top Campaigns</h6>
          ${(data.campaigns || []).length
            ? data.campaigns
                .map(
                  (item) =>
                    `<div class="d-flex justify-content-between small border-bottom py-2"><span>${escapeHtml(item.campaign)}</span><strong>${item.sessions}</strong></div>`
                )
                .join('')
            : '<div class="text-muted small">No campaign tags detected yet.</div>'}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Top Landing Pages</h6>
          ${(data.landingPages || []).length
            ? data.landingPages
                .map(
                  (item) =>
                    `<div class="d-flex justify-content-between small border-bottom py-2"><span>${escapeHtml(item.path)}</span><strong>${item.visits}</strong></div>`
                )
                .join('')
            : '<div class="text-muted small">No landing-page data yet.</div>'}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Top Clicked Content</h6>
          ${(data.contentClicks || []).length
            ? data.contentClicks
                .map((item) => {
                  const width = Math.max(6, Math.round((Number(item.clicks || 0) / topContentMax) * 100));
                  const badge = item.type === 'resource_click' ? 'Resource' : 'Link';
                  return `<div class="mb-3"><div class="d-flex justify-content-between small gap-2"><span>${escapeHtml(item.label)} <span class="badge bg-light text-dark border">${badge}</span></span><strong>${item.clicks}</strong></div><div class="progress" style="height:6px"><div class="progress-bar bg-secondary" style="width:${width}%"></div></div></div>`;
                })
                .join('')
            : '<div class="text-muted small">No click data yet.</div>'}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Audience Devices</h6>
          ${renderAnalyticsBreakdown(data.breakdowns?.devices || [], 'No device signals yet.')}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Browsers</h6>
          ${renderAnalyticsBreakdown(data.breakdowns?.browsers || [], 'No browser breakdown yet.')}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Top Countries</h6>
          ${renderAnalyticsBreakdown(data.breakdowns?.countries || [], 'No geo signals yet.')}
        </div>
        <div class="col-lg-6">
          <h6 class="fw-bold small mb-2">Content Momentum</h6>
          ${renderContentMomentum(data.contentMomentum || [])}
        </div>
        <div class="col-12">
          <h6 class="fw-bold small mb-2">Daily Trend</h6>
          ${renderDailyTrend(data.dailyTrend || [])}
        </div>
        <div class="col-12">
          <h6 class="fw-bold small mb-2">Recent Conversions</h6>
          ${(data.recentConversions || []).length
            ? data.recentConversions
                .map((item) => {
                  const badge = item.type === 'booking_submitted' ? 'Booking' : 'Contact';
                  const detail =
                    item.type === 'booking_submitted'
                      ? item.metadata?.topic || 'Consultation'
                      : `${item.metadata?.messageLength || 0} chars`;
                  return `<div class="border-bottom py-2 small"><div class="d-flex justify-content-between gap-3"><div><span class="badge bg-dark">${badge}</span> <strong>${escapeHtml(item.source)}</strong> <span class="text-muted">/ ${escapeHtml(item.medium)}</span>${item.campaign ? ` <span class="text-muted">(${escapeHtml(item.campaign)})</span>` : ''}<div class="text-muted">${escapeHtml(item.pagePath || '/')} - ${escapeHtml(detail)}</div></div><div class="text-muted">${formatDate(item.createdAt)}</div></div></div>`;
                })
                .join('')
            : '<div class="text-muted small">No conversions recorded yet.</div>'}
        </div>
      </div>
    `;
  } catch (error) {
    adminState.analyticsOverview = null;
    reportLoadFailure('Analytics', error, 'analytics-data', 'Analytics unavailable');
  }
}

export async function exportAnalyticsCsv() {
  const days = Number.parseInt(getById('analytics-range')?.value || '30', 10) || 30;
  const exportButton = getById('analytics-export-button');
  setButtonBusy(exportButton, true, 'Exporting...');

  try {
    const blob = await downloadAnalyticsExport(days);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cyc-analytics-${days}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast('Analytics export downloaded.', {
      tone: 'success',
      title: 'Export ready',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to export analytics right now.'), {
      tone: 'error',
      title: 'Export failed',
    });
  } finally {
    setButtonBusy(exportButton, false);
  }
}

export async function copyAnalyticsReport() {
  const summaryText = adminState.analyticsOverview?.clientReport?.summaryText;
  if (!summaryText) {
    showToast('Load analytics first so there is a report to copy.', {
      tone: 'info',
      title: 'Nothing to copy',
    });
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summaryText);
    } else {
      const helper = document.createElement('textarea');
      helper.value = summaryText;
      helper.setAttribute('readonly', '');
      helper.style.position = 'absolute';
      helper.style.left = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }

    showToast('Client summary copied to clipboard.', {
      tone: 'success',
      title: 'Summary copied',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to copy the analytics summary right now.'), {
      tone: 'error',
      title: 'Copy failed',
    });
  }
}

async function uploadImageToField(fileInputId, targetFieldId, successMessage) {
  const fileInput = getById(fileInputId);
  const targetField = getById(targetFieldId);
  const file = fileInput?.files?.[0];

  if (!file || !targetField) {
    throw new Error('Choose an image to upload first.');
  }

  const result = await uploadImage(file);
  targetField.value = result?.url || '';
  fileInput.value = '';
  showToast(successMessage, {
    tone: 'success',
    title: 'Upload complete',
  });
}

export async function uploadLogoImage() {
  try {
    await uploadImageToField('set-logo-image-file', 'set-logo-image', 'Logo image uploaded.');
    getById('set-logo-type').value = 'image';
    toggleLogoFields();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to upload the logo right now.'), {
      tone: 'error',
      title: 'Upload failed',
    });
  }
}

export async function uploadResourceImage() {
  try {
    await uploadImageToField('form-image-file', 'form-image', 'Resource image uploaded.');
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to upload the resource image right now.'), {
      tone: 'error',
      title: 'Upload failed',
    });
  }
}

export async function uploadTestimonialImage() {
  try {
    await uploadImageToField('testi-image-file', 'testi-image', 'Testimonial image uploaded.');
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to upload the testimonial image right now.'), {
      tone: 'error',
      title: 'Upload failed',
    });
  }
}

export async function moveCollectionItem(collection, id, direction) {
  const items = [...getCollectionItems(collection)];
  const currentIndex = items.findIndex((item) => item.id === id);
  if (currentIndex === -1) {
    return;
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return;
  }

  const [movedItem] = items.splice(currentIndex, 1);
  items.splice(targetIndex, 0, movedItem);

  try {
    await reorderCollection(collection, items.map((item) => item.id));

    if (collection === 'links') {
      await refreshAdminLinks();
    } else if (collection === 'freebies' || collection === 'gear') {
      await refreshResourceTable(collection);
    } else if (collection === 'testimonials') {
      await refreshTestimonials();
    }

    showToast('Display order updated.', {
      tone: 'success',
      title: 'Order saved',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to update the order right now.'), {
      tone: 'error',
      title: 'Order update failed',
    });
  }
}

export async function createBackupAction() {
  const button = getById('backup-create-btn');
  const statusEl = getById('backup-status');
  setButtonBusy(button, true, 'Creating...');
  if (statusEl) statusEl.textContent = 'Creating backup...';

  try {
    const result = await createBackup();
    showToast(result?.data?.message || 'Backup created successfully.', {
      tone: 'success',
      title: 'Backup complete',
    });
    if (statusEl) statusEl.textContent = `Last backup: ${new Date().toLocaleString()}`;
    void listBackupsAction();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to create backup.'), {
      tone: 'error',
      title: 'Backup failed',
    });
    if (statusEl) statusEl.textContent = `Backup failed: ${error.message}`;
  } finally {
    setButtonBusy(button, false);
  }
}

export async function listBackupsAction() {
  const listEl = getById('backup-list');
  if (!listEl) return;

  try {
    const result = await listBackups();
    const backups = result?.data?.backups || [];

    if (!backups.length) {
      listEl.innerHTML = '<div class="text-muted small">No backups yet.</div>';
      return;
    }

    listEl.innerHTML = backups
      .map((backup) => {
        const date = new Date(backup.createdAt);
        const sizeKB = (backup.size / 1024).toFixed(1);
        const downloadUrl = getBackupDownloadUrl(backup.filename);
        return `<div class="d-flex justify-content-between align-items-center small border-bottom py-2">
          <div>
            <strong>${escapeHtml(backup.filename)}</strong>
            <div class="text-muted">${date.toLocaleString()} - ${sizeKB} KB</div>
          </div>
          <div class="d-flex gap-2">
            <a href="${downloadUrl}" class="btn btn-sm btn-outline-dark" download><i class="bi bi-download"></i></a>
            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete-backup" data-filename="${escapeHtml(backup.filename)}"><i class="bi bi-trash"></i></button>
          </div>
        </div>`;
      })
      .join('');
  } catch (error) {
    listEl.innerHTML = `<div class="text-danger small">Unable to load backups: ${escapeHtml(error.message)}</div>`;
  }
}

export async function deleteBackupAction(filename) {
  if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) {
    return;
  }

  try {
    await deleteBackup(filename);
    showToast('Backup deleted.', {
      tone: 'success',
      title: 'Backup removed',
    });
    void listBackupsAction();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to delete backup.'), {
      tone: 'error',
      title: 'Delete failed',
    });
  }
}

export async function runCleanupAction() {
  const button = getById('cleanup-run-btn');
  const resultEl = getById('cleanup-result');
  const daysInput = getById('cleanup-days');
  const retentionDays = Number(daysInput?.value) || 90;

  if (retentionDays < 1 || retentionDays > 365) {
    showToast('Retention days must be between 1 and 365.', {
      tone: 'error',
      title: 'Invalid input',
    });
    return;
  }

  if (!window.confirm(`Delete all analytics data older than ${retentionDays} days? This cannot be undone.`)) {
    return;
  }

  setButtonBusy(button, true, 'Cleaning...');
  if (resultEl) resultEl.innerHTML = '<span class="text-muted">Running cleanup...</span>';

  try {
    const result = await runCleanup(retentionDays);
    const message = result?.data?.message || 'Cleanup completed.';
    if (resultEl) resultEl.innerHTML = `<span class="text-success">${escapeHtml(message)}</span>`;
    showToast(message, {
      tone: 'success',
      title: 'Cleanup complete',
    });
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to run cleanup.'), {
      tone: 'error',
      title: 'Cleanup failed',
    });
    if (resultEl) resultEl.innerHTML = `<span class="text-danger">${escapeHtml(error.message)}</span>`;
  } finally {
    setButtonBusy(button, false);
  }
}

export function initMaintenanceTab() {
  const listBtn = getById('backup-list-btn');
  if (listBtn) {
    listBtn.addEventListener('click', () => void listBackupsAction());
  }

  const createBtn = getById('backup-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => void createBackupAction());
  }

  const cleanupBtn = getById('cleanup-run-btn');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', () => void runCleanupAction());
  }

  const statusEl = getById('backup-status');
  if (statusEl) {
    statusEl.textContent = 'Ready to create backup.';
  }
}

let setupWizard = null;
let setupStep = 1;

export async function checkSetupWizard() {
  try {
    const status = await getSetupStatus();
    if (status?.data?.needsSetup) {
      showSetupWizard();
    }
  } catch {
    // Silently fail - wizard is optional
  }
}

function showSetupWizard() {
  setupStep = 1;
  const modal = getById('setupWizard');
  if (!modal) return;

  showSetupStep(1);
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    setupWizard = new bootstrap.Modal(modal);
    setupWizard.show();
  } else {
    modal.style.display = 'block';
    modal.classList.add('show');
  }
}

function hideSetupWizard() {
  const modal = getById('setupWizard');
  if (!modal) return;

  if (setupWizard) {
    setupWizard.hide();
    setupWizard = null;
  } else {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }
}

function showSetupStep(step) {
  ['setupStep1', 'setupStep2', 'setupStep3', 'setupStepComplete'].forEach((id) => {
    const el = getById(id);
    if (el) el.style.display = 'none';
  });

  const stepEl = getById(`setupStep${step}`);
  if (stepEl) stepEl.style.display = 'block';

  const footer = getById('setupWizardFooter');
  const nextBtn = getById('setupNextBtn');
  const skipBtn = getById('setupSkipBtn');

  if (step === 4) {
    if (footer) footer.style.display = 'none';
  } else {
    if (footer) footer.style.display = 'flex';
    if (nextBtn) nextBtn.textContent = step === 3 ? 'Finish' : 'Next';
    if (skipBtn) skipBtn.style.display = step === 1 ? 'none' : 'inline-block';
  }
}

async function handleSetupNext() {
  if (setupStep < 3) {
    setupStep++;
    showSetupStep(setupStep);
    return;
  }

  await finishSetup();
}

async function finishSetup() {
  const siteName = getById('setup-site-name')?.value?.trim() || 'My Career Site';
  const headline = getById('setup-headline')?.value?.trim() || '';
  const link1Title = getById('setup-link1-title')?.value?.trim();
  const link1Url = getById('setup-link1-url')?.value?.trim() || '#consultation';
  const link2Title = getById('setup-link2-title')?.value?.trim();
  const link2Url = getById('setup-link2-url')?.value?.trim() || '#freebies';
  const enableConsultation = getById('setup-mod-consultation')?.checked ?? true;
  const enableAnalytics = getById('setup-mod-analytics')?.checked ?? false;

  try {
    if (siteName || headline) {
      await updateSiteSettings({
        site_name: siteName,
        headline: headline || siteName,
        subheadline: '',
        footer_text: `Copyright ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
        cta_title: 'Ready to take the next step?',
        cta_subtitle: 'Book a 1:1 session and lets decode your career together.',
        cta_button_text: 'Book a Consultation',
      });
    }

    if (link1Title) {
      await saveLinkData(null, {
        title: link1Title,
        url: link1Url || `#${link1Title.toLowerCase().replace(/\s+/g, '-')}`,
        icon: 'bi-link-45deg',
        link_type: link1Url.startsWith('#') ? 'internal' : 'external',
        internal_target: link1Url.startsWith('#') ? link1Url.slice(1) : null,
        style_bg: '#eef2ff',
        display_order: 0,
        is_active: true,
      });
    }

    if (link2Title) {
      await saveLinkData(null, {
        title: link2Title,
        url: link2Url || `#${link2Title.toLowerCase().replace(/\s+/g, '-')}`,
        icon: 'bi-download',
        link_type: link2Url.startsWith('#') ? 'internal' : 'external',
        internal_target: link2Url.startsWith('#') ? link2Url.slice(1) : null,
        style_bg: '#f5f7f8',
        display_order: 1,
        is_active: true,
      });
    }

    await updateModuleStatus('consultation', enableConsultation);
    await updateModuleStatus('analytics', enableAnalytics);

    await completeSetup();

    showSetupStep(4);
    setTimeout(() => {
      hideSetupWizard();
      void refreshDashboard();
      void loadSiteSettingsAdmin();
      void refreshAdminLinks();
      void refreshModulesAdmin();
    }, 1500);
  } catch (error) {
    showToast(formatErrorMessage(error, 'Setup failed. You can continue to the dashboard.'), {
      tone: 'error',
      title: 'Setup issue',
    });
    hideSetupWizard();
  }
}

function handleSetupSkip() {
  hideSetupWizard();
}

export function bindSetupWizardEvents() {
  getById('setupNextBtn')?.addEventListener('click', () => void handleSetupNext());
  getById('setupSkipBtn')?.addEventListener('click', () => handleSetupSkip());
}
