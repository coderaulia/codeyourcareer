import anime from 'animejs/lib/anime.es.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../style.css';
import {
  fetchResources,
  handleContactSubmit,
  handleFormSubmit,
  initPublicPage,
  trackClick,
} from './features/public.js';
import { navigateTo } from './shared/utils.js';

window.anime = anime;

Object.assign(window, {
  fetchResources,
  handleContactSubmit,
  handleFormSubmit,
  navigateTo,
  trackClick,
});

initPublicPage();
