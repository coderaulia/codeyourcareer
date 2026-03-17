import {
  createBooking,
  createContactMessage,
  getActiveLinks,
  getFeaturedTestimonials,
  getModules,
  getResources,
  getSiteSettings,
  recordLinkClick,
} from '../api/data.js';
import { MODULES } from '../shared/modules.js';
import {
  escapeHtml,
  formatErrorMessage,
  navigateTo,
  setButtonBusy,
  setElementState,
  showToast,
} from '../shared/utils.js';

let publicUiBound = false;

function setPublicState(id, title, message, tone = 'muted') {
  setElementState(document.getElementById(id), {
    tone,
    title,
    message,
    compact: false,
  });
}

export async function loadSiteSettings() {
  try {
    const data = await getSiteSettings();
    if (!data) {
      return;
    }

    applyTheme(data);
    applyContent(data);
  } catch (error) {
    console.log('Settings load skipped:', error.message);
  }
}

function applyTheme(settings) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--bg-color', settings.bg_color || '#f8f9fa');
  rootStyle.setProperty('--text-main', settings.text_color || '#111111');
  rootStyle.setProperty('--text-sec', settings.text_secondary || '#555555');
  rootStyle.setProperty('--accent', settings.accent_color || '#000000');
  rootStyle.setProperty('--card-bg', settings.card_bg || '#ffffff');
  rootStyle.setProperty('--card-border', settings.card_border || '#e0e0e0');
  rootStyle.setProperty('--cta-bg', settings.cta_bg || '#111111');
  rootStyle.setProperty('--cta-text', settings.cta_text || '#ffffff');
  rootStyle.setProperty('--cta-btn-bg', settings.cta_btn_bg || '#ffffff');
  rootStyle.setProperty('--cta-btn-text', settings.cta_btn_text || '#000000');
}

function applyContent(settings) {
  const getById = (id) => document.getElementById(id);

  if (getById('site-name')) {
    getById('site-name').textContent = settings.site_name || '';
  }

  if (getById('site-headline')) {
    getById('site-headline').textContent = settings.headline || '';
  }

  if (getById('site-subheadline')) {
    getById('site-subheadline').textContent = settings.subheadline || '';
  }

  if (getById('site-footer')) {
    getById('site-footer').innerHTML = `<p>${escapeHtml(settings.footer_text || '')}</p>`;
  }

  if (getById('cta-title')) {
    getById('cta-title').textContent = settings.cta_title || '';
  }

  if (getById('cta-subtitle')) {
    getById('cta-subtitle').textContent = settings.cta_subtitle || '';
  }

  if (getById('cta-button')) {
    getById('cta-button').textContent = settings.cta_button_text || '';
  }

  const logoElement = getById('site-logo');
  if (!logoElement) {
    return;
  }

  if (settings.logo_type === 'emoji') {
    logoElement.innerHTML = `<div class="logo-emoji">${escapeHtml(settings.logo_emoji) || '&#128187;'}</div>`;
    return;
  }

  if (settings.logo_type === 'image' && settings.logo_image_url) {
    logoElement.innerHTML = `<img class="logo-image" src="${escapeHtml(settings.logo_image_url)}" alt="Logo">`;
    return;
  }

  if (settings.logo_svg) {
    logoElement.innerHTML = `<div class="logo-svg">${settings.logo_svg}</div>`;
  }
}

export async function loadModules() {
  try {
    const modules = await getModules();

    Object.keys(MODULES).forEach((key) => {
      delete MODULES[key];
    });

    modules.forEach((moduleItem) => {
      MODULES[moduleItem.slug] = moduleItem.is_enabled;
    });

    const show = (id, isVisible) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = isVisible ? '' : 'none';
      }
    };

    show('cta-section', MODULES.consultation);
    show('testimonials-section', MODULES.testimonials);
    show('contact-home-section', MODULES.contact);

    if (MODULES.testimonials) {
      await loadTestimonials();
    }
  } catch (error) {
    console.log('Modules load skipped:', error.message);
  }
}

export async function loadLinks() {
  const container = document.getElementById('dynamic-links');
  if (!container) {
    return;
  }

  setPublicState('dynamic-links', 'Loading links', 'Fetching the latest shortcuts for you...');

  try {
    const links = await getActiveLinks();

    if (!links || !links.length) {
      setPublicState('dynamic-links', 'No links yet', 'This page is ready for content. Check back soon.');
      return;
    }

    const externalLinks = links.filter((link) => link.link_type === 'external');
    const internalLinks = links.filter((link) => link.link_type === 'internal');

    let markup = '';

    externalLinks.forEach((link) => {
      const trackAttributes = MODULES.analytics
        ? ` data-track-id="${escapeHtml(String(link.id))}" data-track-title="${escapeHtml(link.title || '')}"`
        : '';

      markup += `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" class="link-card"${trackAttributes}><span class="link-icon"><i class="bi ${escapeHtml(link.icon)}"></i></span><span class="link-text">${escapeHtml(link.title)}</span><i class="bi bi-arrow-right"></i></a>`;
    });

    if (externalLinks.length && internalLinks.length) {
      markup += '<div class="my-2"></div>';
    }

    internalLinks.forEach((link) => {
      const backgroundStyle = link.style_bg ? `background-color:${escapeHtml(link.style_bg)};` : '';
      const icon = link.internal_target === 'freebies' ? 'bi-download' : 'bi-box-arrow-up-right';
      const trackAttributes = MODULES.analytics
        ? ` data-track-id="${escapeHtml(String(link.id))}" data-track-title="${escapeHtml(link.title || '')}"`
        : '';

      markup += `<button type="button" class="link-card link-card-button" style="${backgroundStyle}" data-internal-target="${escapeHtml(link.internal_target || '')}"${trackAttributes}><span class="link-icon"><i class="bi ${escapeHtml(link.icon)}"></i></span><span class="link-text">${escapeHtml(link.title)}</span><i class="bi ${icon}"></i></button>`;
    });

    container.innerHTML = markup;
    bindDynamicLinkActions(container);
  } catch (error) {
    console.error('Links error:', error);
    setPublicState('dynamic-links', 'Links unavailable', formatErrorMessage(error), 'error');
  }
}

function bindDynamicLinkActions(container) {
  container.querySelectorAll('[data-track-id]').forEach((element) => {
    element.addEventListener('click', () => {
      trackClick(element.dataset.trackId || '', element.dataset.trackTitle || '');
    });
  });

  container.querySelectorAll('[data-internal-target]').forEach((element) => {
    element.addEventListener('click', () => {
      navigateTo(element.dataset.internalTarget || '');
    });
  });
}

export async function fetchResources(table, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  setElementState(container, {
    tone: 'muted',
    title: `Loading ${table}`,
    message: 'Fetching the latest items...',
  });

  try {
    const data = await getResources(table);
    container.innerHTML =
      data && data.length
        ? data
            .map(
              (item) =>
                `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" class="link-card link-card-resource"><div class="link-card-resource__content">${item.image_url ? `<img class="link-card-resource__image" src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}">` : ''}<div><div class="fw-bold">${escapeHtml(item.title)}</div><div class="small text-muted">${escapeHtml(item.description || item.category || '')}</div></div></div><i class="bi bi-box-arrow-up-right"></i></a>`
            )
            .join('')
        : '';

    if (!data || !data.length) {
      setElementState(container, {
        tone: 'muted',
        title: `No ${table} yet`,
        message: 'Fresh content will appear here soon.',
      });
    }
  } catch (error) {
    setElementState(container, {
      tone: 'error',
      title: `Unable to load ${table}`,
      message: formatErrorMessage(error),
    });
  }
}

export async function handleFormSubmit(event) {
  event.preventDefault();

  if (document.getElementById('hp_field')?.value !== '') {
    return;
  }

  const submitButton = event.target.querySelector('button');
  setButtonBusy(submitButton, true, 'Processing request...');

  try {
    await createBooking({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      topic: document.getElementById('topic').value,
      schedule: document.getElementById('schedule').value,
    });

    showToast('Your consultation request is in. You will hear back soon.', {
      tone: 'success',
      title: 'Booking received',
    });
    navigateTo('home');
    event.target.reset();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to book the session right now.'), {
      tone: 'error',
      title: 'Booking failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export async function loadTestimonials() {
  const container = document.getElementById('testimonials-list');
  if (!container) {
    return;
  }

  try {
    const data = await getFeaturedTestimonials();

    if (!data || !data.length) {
      const testimonialsSection = document.getElementById('testimonials-section');
      if (testimonialsSection) {
        testimonialsSection.style.display = 'none';
      }
      return;
    }

    container.innerHTML = data
      .map(
        (testimonial) =>
          `<div class="testimonial-card">${testimonial.image_url ? `<div class="testimonial-card__media"><img class="testimonial-card__avatar" src="${escapeHtml(testimonial.image_url)}" alt="${escapeHtml(testimonial.name)}"></div>` : ''}<div class="stars">${'&#9733;'.repeat(testimonial.rating)}${'&#9734;'.repeat(5 - testimonial.rating)}</div><div class="quote">"${escapeHtml(testimonial.content)}"</div><div class="author">${escapeHtml(testimonial.name)}</div>${testimonial.role ? `<div class="role">${escapeHtml(testimonial.role)}</div>` : ''}</div>`
      )
      .join('');
  } catch {
  }
}

export async function handleContactSubmit(event) {
  event.preventDefault();

  if (document.getElementById('hp_contact')?.value !== '') {
    return;
  }

  const submitButton = event.target.querySelector('button');
  setButtonBusy(submitButton, true, 'Sending message...');

  try {
    await createContactMessage({
      name: document.getElementById('contact-name').value,
      email: document.getElementById('contact-email').value,
      message: document.getElementById('contact-message').value,
    });

    showToast('Your message has been sent. Thank you for reaching out.', {
      tone: 'success',
      title: 'Message sent',
    });
    navigateTo('home');
    event.target.reset();
  } catch (error) {
    showToast(formatErrorMessage(error, 'Unable to send your message right now.'), {
      tone: 'error',
      title: 'Message failed',
    });
  } finally {
    setButtonBusy(submitButton, false);
  }
}

export function trackClick(linkId, title) {
  void recordLinkClick({ link_id: linkId, link_title: title });
}

export function initPublicPage() {
  if (!publicUiBound) {
    publicUiBound = true;

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-nav-target]');
      if (!target) {
        return;
      }

      event.preventDefault();
      navigateTo(target.dataset.navTarget || '');
    });

    document.getElementById('bookingForm')?.addEventListener('submit', (event) => {
      void handleFormSubmit(event);
    });

    document.getElementById('contactForm')?.addEventListener('submit', (event) => {
      void handleContactSubmit(event);
    });
  }

  const scheduleInput = document.getElementById('schedule');
  if (scheduleInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    scheduleInput.min = now.toISOString().slice(0, 16);
  }

  if (document.getElementById('dynamic-links')) {
    void loadSiteSettings();
    void loadModules();
    void loadLinks();
  }

  const animator = typeof window !== 'undefined' ? window.anime : undefined;
  if (animator) {
    animator({
      targets: '.fade-in-up',
      opacity: [0, 1],
      translateY: [40, 0],
      delay: animator.stagger(150),
      duration: 1000,
      easing: 'easeOutExpo',
    });
  }
}
