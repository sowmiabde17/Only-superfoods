<!--
  ScrollInit.svelte — Client-side Lenis + GSAP bootstrap
  Initializes smooth scroll and section-pinning transitions.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';

  let lenis = $state(null);
  let scrollTriggers = [];

  onMount(async () => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql.matches) return;

    // Initialize Lenis smooth scroll
    const { initSmoothScroll } = await import('../lib/scroll.js');
    lenis = await initSmoothScroll();

    // Set up section-pinning parallax transitions
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);

    gsap.registerPlugin(ScrollTrigger);

    // Pin the hero section briefly as user scrolls into the story
    const heroSection = document.querySelector('[data-section="hero"]');
    const storySection = document.querySelector('[data-section="story"]');

    if (heroSection && storySection) {
      const st = ScrollTrigger.create({
        trigger: heroSection,
        start: 'top top',
        end: '+=30%',
        pin: true,
        pinSpacing: true,
      });
      scrollTriggers.push(st);
    }
  });

  onDestroy(() => {
    scrollTriggers.forEach(st => st?.kill());
    scrollTriggers = [];
    if (lenis) {
      lenis.destroy();
    }
  });
</script>

