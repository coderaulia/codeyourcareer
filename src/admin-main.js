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
  loadAnalytics,
  refreshAdminLinks,
  refreshBookings,
  refreshDashboard,
  refreshMessages,
  refreshModulesAdmin,
  refreshResources,
  refreshTestimonials,
  refreshVersionInfo,
  resetLinkForm,
  saveLink,
  syncLinkStyleBg,
  saveResource,
  saveSiteSettings,
  saveTestimonial,
  switchAdminTab,
  toggleInternalFields,
  toggleLogoFields,
  toggleModule,
} from './features/admin.js';
import { adminLogin, adminLogout, checkAdminSession, submitPasswordChange } from './features/auth.js';

window.anime = anime;

Object.assign(window, {
  adminLogin,
  adminLogout,
  confirmBooking,
  deleteItem,
  deleteLink,
  deleteMessage,
  deleteTestimonial,
  editItem,
  editLink,
  editTestimonial,
  loadAnalytics,
  refreshAdminLinks,
  refreshBookings,
  refreshDashboard,
  refreshMessages,
  refreshModulesAdmin,
  refreshResources,
  refreshTestimonials,
  refreshVersionInfo,
  resetLinkForm,
  saveLink,
  saveResource,
  syncLinkStyleBg,
  saveSiteSettings,
  saveTestimonial,
  submitPasswordChange,
  switchAdminTab,
  toggleInternalFields,
  toggleLogoFields,
  toggleModule,
});

checkAdminSession();
