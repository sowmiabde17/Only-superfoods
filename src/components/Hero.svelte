<!--
  Hero.svelte — Mobile Hero Section
  Follows exact spec:
  - Pure white background with subtle OGL.js fluid ambient motion
  - Staggered GSAP entrance animation (logo area -> headline -> subheadline -> CTA)
  - Organic blob-masked real photography contrasting with sharp 2-4px UI shapes
  - Product-led value prop headline in Ink/Navy (#0B1F2E), body in #4A5A52
  - Primary button in #A8D632 with sharp corners
  - sessionStorage returning-visitor check (0.3s vs 1.2s)
  - prefers-reduced-motion check
  - Svelte 5 runes mode
-->
<script>
  import { onMount } from 'svelte';
  import { heroImage } from '../data/images.js';
  import FluidShader from './FluidShader.svelte';

  /** @type {HTMLElement} */
  let heroRef = $state(null);

  /** @type {HTMLElement} */
  let badgeRef = $state(null);
  let headlineRef = $state(null);
  let subheadlineRef = $state(null);
  let visualRef = $state(null);
  let ctaRef = $state(null);
  let locationRef = $state(null);

  /** Whether prefers-reduced-motion is active */
  let reducedMotion = $state(false);

  onMount(() => {
    // Check reduced-motion preference
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;

    if (reducedMotion) {
      [badgeRef, headlineRef, subheadlineRef, visualRef, ctaRef, locationRef].forEach((el) => {
        if (el) {
          el.style.opacity = '1';
          el.style.transform = 'none';
        }
      });
      sessionStorage.setItem('osf_has_visited', 'true');
      return;
    }

    // Dynamically import GSAP
    import('gsap').then(({ gsap }) => {
      const isReturning = sessionStorage.getItem('osf_has_visited') === 'true';
      const totalDuration = isReturning ? 0.35 : 1.1;
      const stagger = totalDuration * 0.18;

      const targets = [badgeRef, headlineRef, subheadlineRef, visualRef, ctaRef, locationRef].filter(Boolean);

      gsap.fromTo(
        targets,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: totalDuration * 0.45,
          stagger,
          ease: 'power2.out',
          onComplete: () => {
            sessionStorage.setItem('osf_has_visited', 'true');
          },
        }
      );
    });
  });

  /** Smooth-scroll to the products section */
  function scrollToProducts() {
    const productsEl = document.querySelector('[data-section="products"]');
    if (productsEl) {
      productsEl.scrollIntoView({ behavior: 'smooth' });
    }
  }
</script>

<section
  bind:this={heroRef}
  data-section="hero"
  class="relative flex min-h-[92svh] flex-col justify-between overflow-hidden px-5 pt-6 pb-12 bg-white"
>
  <!-- Ambient OGL WebGL fluid shader on pure white background -->
  <FluidShader />

  <div class="mx-auto flex w-full max-w-[430px] flex-col gap-5 my-auto">
    <!-- Brand accent badge (Logo-exclusive Orange-to-Red gradient accent moment) -->
    <div
      bind:this={badgeRef}
      class="self-start opacity-0"
      style="transform: translateY(22px)"
    >
      <div
        class="inline-flex items-center gap-2 rounded-sm border border-[#E4E4DC] bg-[#F7F7F2] px-3 py-1 shadow-xs"
      >
        <!-- Deliberate logo gradient accent pip -->
        <span class="h-2 w-2 rounded-full gradient-accent"></span>
        <span class="text-[11px] font-semibold tracking-wider uppercase text-[#2B5A16]">
          Direct from Kadugodi grower
        </span>
      </div>
    </div>

    <!-- Product-led Headline in Ink/Navy (#0B1F2E) -->
    <h1
      bind:this={headlineRef}
      class="text-[2.1rem] sm:text-[2.4rem] font-bold leading-[1.12] tracking-tight text-[#0B1F2E] opacity-0"
      style="transform: translateY(22px); font-family: 'Playfair Display', Georgia, serif;"
    >
      Harvested this morning.<br />
      At your door today.
    </h1>

    <!-- Subheadline in warm body text (#4A5A52) -->
    <p
      bind:this={subheadlineRef}
      class="max-w-[360px] text-[0.935rem] leading-relaxed text-[#4A5A52] opacity-0"
      style="transform: translateY(22px)"
    >
      Grey oyster mushrooms, live microgreens, raw kombucha &amp; free-range desi eggs with a 48-hour farm-to-table shelf life. Zero middlemen.
    </p>

    <!-- Organic blob-masked hero photography -->
    <div
      bind:this={visualRef}
      class="relative my-2 w-full max-w-[390px] self-center opacity-0"
      style="transform: translateY(22px)"
    >
      <div class="relative overflow-hidden p-1">
        <img
          src={heroImage}
          alt="Freshly harvested grey oyster mushrooms and microgreens"
          class="aspect-[16/11] w-full object-cover shadow-sm blob-mask-1"
          loading="eager"
          fetchpriority="high"
        />
        <!-- Understated freshness pip -->
        <div class="absolute bottom-4 right-4 bg-white/95 backdrop-blur-xs border border-[#E4E4DC] px-2.5 py-1 rounded-sm shadow-xs">
          <span class="text-[10px] font-bold uppercase tracking-wider text-[#2B5A16]">
            ● Today's Harvest Live
          </span>
        </div>
      </div>
    </div>

    <!-- Action stack -->
    <div class="flex flex-col gap-3 pt-1">
      <!-- Primary CTA button: Sharp 2px corners, #A8D632 brand green, press micro-interaction -->
      <button
        bind:this={ctaRef}
        onclick={scrollToProducts}
        class="w-full rounded-sm bg-[#A8D632] py-3.5 px-6 text-center text-sm font-bold text-white shadow-xs press active:bg-[#2B5A16] hover:bg-[#96c429] transition-colors opacity-0"
        style="transform: translateY(22px)"
      >
        Explore Today's Harvest
      </button>

      <!-- Location tag -->
      <div
        bind:this={locationRef}
        class="flex items-center justify-center gap-1.5 text-xs text-[#4A5A52]/80 opacity-0"
        style="transform: translateY(22px)"
      >
        <svg
          class="h-3.5 w-3.5 text-[#2B5A16]"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
            clip-rule="evenodd"
          />
        </svg>
        <span>Grown &amp; delivered from <strong>Kadugodi / Whitefield</strong> (560067)</span>
      </div>
    </div>
  </div>
</section>
