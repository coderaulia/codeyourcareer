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
import { escapeHtml, navigateTo } from '../shared/utils.js';

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

  try {
    const links = await getActiveLinks();

    if (!links || !links.length) {
      container.innerHTML = '<div class="text-muted small text-center">No links yet.</div>';
      return;
    }

    const externalLinks = links.filter((link) => link.link_type === 'external');
    const internalLinks = links.filter((link) => link.link_type === 'internal');

    let markup = '';

    externalLinks.forEach((link) => {
      const clickTrack = MODULES.analytics
        ? `onclick="trackClick(${JSON.stringify(String(link.id))}, ${JSON.stringify(link.title || '')}); return true;"`
        : '';

      markup += `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer" class="link-card" ${clickTrack}><span class="link-icon"><i class="bi ${escapeHtml(link.icon)}"></i></span><span class="link-text">${escapeHtml(link.title)}</span><i class="bi bi-arrow-right"></i></a>`;
    });

    if (externalLinks.length && internalLinks.length) {
      markup += '<div class="my-2"></div>';
    }

    internalLinks.forEach((link) => {
      const backgroundStyle = link.style_bg ? `background-color:${escapeHtml(link.style_bg)};` : '';
      const icon = link.internal_target === 'freebies' ? 'bi-download' : 'bi-box-arrow-up-right';
      const clickTrack = MODULES.analytics
        ? `trackClick(${JSON.stringify(String(link.id))}, ${JSON.stringify(link.title || '')}); `
        : '';

      markup += `<div onclick="${clickTrack}navigateTo(${JSON.stringify(link.internal_target || '')})" class="link-card" style="${backgroundStyle}"><span class="link-icon"><i class="bi ${escapeHtml(link.icon)}"></i></span><span class="link-text">${escapeHtml(link.title)}</span><i class="bi ${icon}"></i></div>`;
    });

    container.innerHTML = markup;
  } catch (error) {
    console.error('Links error:', error);
  }
}

export async function fetchResources(table, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  container.innerHTML = '<div class="text-muted small text-center py-4">Loading...</div>';

  try {
    const data = await getResources(table);
    container.innerHTML =
      data && data.length
        ? data
            .map(
              (item) =>
                `<a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer" class="link-card"><div><div class="fw-bold">${escapeHtml(item.title)}</div><div class="small text-muted">${escapeHtml(item.description || item.category || '')}</div></div><i class="bi bi-box-arrow-up-right"></i></a>`
            )
            .join('')
        : '<div class="text-muted small text-center">No items found.</div>';
  } catch {
    container.innerHTML = '<div class="text-danger small text-center">Failed to load.</div>';
  }
}

export async function handleFormSubmit(event) {
  event.preventDefault();

  if (document.getElementById('hp_field')?.value !== '') {
    return;
  }

  const submitButton = event.target.querySelector('button');
  submitButton.disabled = true;
  submitButton.innerText = 'Processing...';

  try {
    await createBooking({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      topic: document.getElementById('topic').value,
      schedule: document.getElementById('schedule').value,
    });

    alert('Success! Session booked.');
    navigateTo('home');
    event.target.reset();
  } catch (error) {
    alert(`Error: ${error.message || 'Failed'}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Submit Request';
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
          `<div class="testimonial-card"><div class="stars">${'&#9733;'.repeat(testimonial.rating)}${'&#9734;'.repeat(
            5 - testimonial.rating
          )}</div><div class="quote">"${escapeHtml(testimonial.content)}"</div><div class="author">${escapeHtml(
            testimonial.name
          )}</div>${testimonial.role ? `<div class="role">${escapeHtml(testimonial.role)}</div>` : ''}</div>`
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
  submitButton.disabled = true;
  submitButton.innerText = 'Sending...';

  try {
    await createContactMessage({
      name: document.getElementById('contact-name').value,
      email: document.getElementById('contact-email').value,
      message: document.getElementById('contact-message').value,
    });

    alert('Message sent! Thank you.');
    navigateTo('home');
    event.target.reset();
  } catch (error) {
    alert(`Error: ${error.message || 'Failed'}`);
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = 'Send Message';
  }
}

export function trackClick(linkId, title) {
  void recordLinkClick({ link_id: linkId, link_title: title });
}

export function initPublicPage() {
  const scheduleInput = document.getElementById('schedule');
  if (scheduleInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    scheduleInput.min = now.toISOString().slice(0, 16);
  }

  if (document.getElementById('dynamic-links')) {
    loadSiteSettings();
    loadModules();
    loadLinks();
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
