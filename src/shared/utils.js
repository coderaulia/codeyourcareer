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
