import anime from 'animejs/lib/anime.es.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../style.css';
import {
  confirmBooking,
  deleteItem,
  deleteLink,
  deleteMessage,
  deleteTestimonial,
  editItem,
  editLink,
  editTestimonial,
  exportAnalyticsCsv,
  loadAnalytics,
  moveCollectionItem,
  resetLinkForm,
  saveLink,
  saveResource,
  saveSiteSettings,
  saveTestimonial,
  setBookingStatusAction,
  switchAdminTab,
  syncLinkStyleBg,
  toggleInternalFields,
  toggleLogoFields,
  toggleMessageRead,
  toggleModule,
  uploadLogoImage,
  uploadResourceImage,
  uploadTestimonialImage,
} from './features/admin.js';
import { adminLogin, adminLogout, checkAdminSession, submitPasswordChange } from './features/auth.js';

window.anime = anime;

function openAdminTab(tabName) {
  const button = document.querySelector(`[data-admin-tab="${tabName}"]`);
  if (!button) {
    return;
  }

  switchAdminTab(button, tabName);
}

function bindAdminForms() {
  document.getElementById('admin-login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void adminLogin();
  });

  document.getElementById('password-change-form')?.addEventListener('submit', (event) => {
    void submitPasswordChange(event);
  });

  document.getElementById('link-form')?.addEventListener('submit', (event) => {
    void saveLink(event);
  });

  document.getElementById('resource-form')?.addEventListener('submit', (event) => {
    void saveResource(event);
  });

  document.getElementById('testimonial-form')?.addEventListener('submit', (event) => {
    void saveTestimonial(event);
  });
}

function bindAdminControls() {
  document.getElementById('admin-logout-button')?.addEventListener('click', () => {
    void adminLogout();
  });

  document.getElementById('manage-modules-button')?.addEventListener('click', () => {
    openAdminTab('modules');
  });

  document.getElementById('site-settings-save')?.addEventListener('click', () => {
    void saveSiteSettings();
  });

  document.getElementById('upload-logo-button')?.addEventListener('click', () => {
    void uploadLogoImage();
  });

  document.getElementById('upload-resource-button')?.addEventListener('click', () => {
    void uploadResourceImage();
  });

  document.getElementById('upload-testimonial-button')?.addEventListener('click', () => {
    void uploadTestimonialImage();
  });

  document.getElementById('link-form-cancel')?.addEventListener('click', () => {
    resetLinkForm();
  });

  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      openAdminTab(button.dataset.adminTab || 'overview');
    });
  });

  document.getElementById('set-logo-type')?.addEventListener('change', () => {
    toggleLogoFields();
  });

  document.getElementById('link-type')?.addEventListener('change', () => {
    toggleInternalFields();
  });

  document.getElementById('link-style-bg-picker')?.addEventListener('input', (event) => {
    syncLinkStyleBg(event.target.value);
  });

  document.getElementById('link-style-bg')?.addEventListener('input', (event) => {
    syncLinkStyleBg(event.target.value, true);
  });

  document.getElementById('link-style-bg')?.addEventListener('change', (event) => {
    syncLinkStyleBg(event.target.value);
  });

  document.getElementById('analytics-range')?.addEventListener('change', () => {
    void loadAnalytics();
  });

  document.getElementById('analytics-export-button')?.addEventListener('click', () => {
    void exportAnalyticsCsv();
  });
}

function bindDelegatedAdminActions() {
  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }

    const { action, id = '', collection = '', direction = '', table = '', status = '' } = target.dataset;

    switch (action) {
      case 'move-collection':
        void moveCollectionItem(collection, id, direction);
        break;
      case 'edit-link':
        editLink(id);
        break;
      case 'delete-link':
        void deleteLink(id);
        break;
      case 'edit-resource':
        editItem(table, id);
        break;
      case 'delete-resource':
        void deleteItem(table, id);
        break;
      case 'confirm-booking':
        void confirmBooking(id);
        break;
      case 'set-booking-status':
        void setBookingStatusAction(id, status);
        break;
      case 'delete-booking':
        void deleteItem('bookings', id);
        break;
      case 'edit-testimonial':
        editTestimonial(id);
        break;
      case 'delete-testimonial':
        void deleteTestimonial(id);
        break;
      case 'toggle-message-read':
        void toggleMessageRead(id, target.dataset.nextState === 'true');
        break;
      case 'delete-message':
        void deleteMessage(id);
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', (event) => {
    const target = event.target.closest('[data-action="toggle-module"]');
    if (!target) {
      return;
    }

    void toggleModule(target.dataset.slug || '', Boolean(target.checked));
  });
}

function bindAdminUi() {
  bindAdminForms();
  bindAdminControls();
  bindDelegatedAdminActions();
}

bindAdminUi();
checkAdminSession();
