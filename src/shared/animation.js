let animePromise = null;

export function primeAnimator() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.anime) {
    return Promise.resolve(window.anime);
  }

  if (!animePromise) {
    animePromise = import('animejs/lib/anime.es.js')
      .then((module) => {
        window.anime = module.default;
        return window.anime;
      })
      .catch((error) => {
        console.warn('Animation library failed to load:', error);
        return null;
      });
  }

  return animePromise;
}
