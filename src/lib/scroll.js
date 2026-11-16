/**
 * Lenis smooth scroll + GSAP ScrollTrigger integration
 * Sets up Lenis and syncs it with GSAP's ticker for buttery 120fps scrolling.
 * Import and call initSmoothScroll() from a client-side component.
 */

export async function initSmoothScroll() {
  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }

  const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
    import('lenis'),
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    touchMultiplier: 2,
  });

  // Sync Lenis scroll position with ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  // Use GSAP ticker to drive Lenis — ensures 120fps sync
  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  // Disable GSAP's built-in lag smoothing so it stays in sync with Lenis
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

