function getAnimator() {
  return typeof window !== 'undefined' ? window.anime : undefined;
}

export function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(value) {
  if (!value) {
    return 'N/A';
  }

  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  } catch {
    return value;
  }
}

export function formatErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const message = error?.message || fallback;
  if (error?.requestId && /server|went wrong/i.test(message)) {
    return `${message} Reference: ${error.requestId}`;
  }

  return message;
}

function ensureToastRegion() {
  if (typeof document === 'undefined') {
    return null;
  }

  let region = document.getElementById('app-toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'app-toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }

  return region;
}

export function showToast(message, options = {}) {
  const { duration = 4200, tone = 'info', title = '' } = options;
  const region = ensureToastRegion();
  if (!region || !message) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `app-toast app-toast-${tone}`;
  toast.innerHTML = `
    <div class="app-toast__content">
      ${title ? `<div class="app-toast__title">${escapeHtml(title)}</div>` : ''}
      <div>${escapeHtml(message)}</div>
    </div>
    <button type="button" class="app-toast__close" aria-label="Dismiss notification">&times;</button>
  `;

  const close = () => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector('.app-toast__close')?.addEventListener('click', close);
  region.appendChild(toast);
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  window.setTimeout(close, duration);
}

export function buildStateMarkup({ tone = 'muted', title, message = '', compact = false } = {}) {
  return `
    <div class="panel-feedback panel-feedback-${tone}${compact ? ' panel-feedback-compact' : ''}">
      <div class="panel-feedback__title">${escapeHtml(title || '')}</div>
      ${message ? `<div class="panel-feedback__message">${escapeHtml(message)}</div>` : ''}
    </div>
  `;
}

export function setElementState(element, config) {
  if (!element) {
    return;
  }

  element.innerHTML = buildStateMarkup(config);
}

export function setButtonBusy(button, isBusy, busyText, idleText = '') {
  if (!button) {
    return;
  }

  if (isBusy) {
    if (!button.dataset.defaultText) {
      button.dataset.defaultText = idleText || button.textContent;
    }

    button.disabled = true;
    button.textContent = busyText;
    return;
  }

  button.disabled = false;
  button.textContent = button.dataset.defaultText || idleText || button.textContent;
}

export function invalidateField(fieldOrId, message) {
  const field =
    typeof fieldOrId === 'string' ? document.getElementById(fieldOrId) : fieldOrId;

  if (!field) {
    throw new Error(message);
  }

  field.setCustomValidity(message);
  field.reportValidity();
  field.focus();
  window.setTimeout(() => field.setCustomValidity(''), 0);
  throw new Error(message);
}

export function navigateTo(id) {
  const current = document.querySelector('.section-view.active');
  const next = document.getElementById(id);

  if (!next) {
    return;
  }

  if (id === 'freebies' && typeof window.fetchResources === 'function') {
    window.fetchResources('freebies', 'freebies-list');
  }

  if (id === 'gear' && typeof window.fetchResources === 'function') {
    window.fetchResources('gear', 'gear-list');
  }

  if (!current || current === next) {
    showView(next);
    return;
  }

  const animator = getAnimator();
  if (animator) {
    animator({
      targets: current,
      opacity: 0,
      translateY: -20,
      duration: 300,
      easing: 'easeInQuad',
      complete: () => {
        current.classList.remove('active');
        current.style.display = 'none';
        showView(next);
      },
    });
    return;
  }

  current.classList.remove('active');
  current.style.display = 'none';
  showView(next);
}

export function showView(element) {
  if (!element) {
    return;
  }

  element.style.display = 'block';
  element.classList.add('active');

  const animator = getAnimator();
  if (animator) {
    animator({
      targets: element,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500,
      easing: 'easeOutExpo',
    });
  }
}
