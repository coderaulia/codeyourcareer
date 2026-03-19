import '../style.css';
import {
  fetchResources,
  handleContactSubmit,
  handleFormSubmit,
  initPublicPage,
  trackClick,
} from './features/public.js';
import { primeAnimator } from './shared/animation.js';
import { navigateTo } from './shared/utils.js';

Object.assign(window, {
  fetchResources,
  handleContactSubmit,
  handleFormSubmit,
  navigateTo,
  trackClick,
});

void primeAnimator();
initPublicPage();
