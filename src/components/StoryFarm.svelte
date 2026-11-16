<!--
  StoryFarm.svelte — 3-panel farm narrative section
  Walking through: Growing -> Harvest -> Delivery
  Features custom flat brand-colored illustrations + organic blob-masked photography.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { storyImages } from '../data/images.js';

  const panels = [
    {
      id: 'growing',
      stage: 'Stage 01 · Growing',
      heading: 'Climate-Controlled Growing Rooms',
      image: storyImages.growing,
      alt: 'Oyster mushroom clusters growing on natural substrate',
      copy: `We cultivate our grey oysters inside clean, humidity-controlled fruiting rooms in Kadugodi. No chemical sprays, zero synthetic fertilizers. Just organic hardwood sawdust, filtered fresh air, and twice-daily hand misting so every cap grows tender and thick.`,
      illustration: 'growing',
    },
    {
      id: 'harvest',
      stage: 'Stage 02 · Harvest',
      heading: 'Hand-Picked At 6:00 AM',
      image: storyImages.harvest,
      alt: 'Hand harvesting fresh grey oyster mushrooms and microgreens',
      copy: `We harvest only what is ordered. At dawn, clusters are checked by hand and harvested when caps curl downward at peak moisture and aromatics. They never sit in cold storage for days—they are packed immediately into breathable compostable boxes.`,
      illustration: 'harvest',
    },
    {
      id: 'delivery',
      stage: 'Stage 03 · Delivery',
      heading: 'Straight To Your Door In Hours',
      image: storyImages.delivery,
      alt: 'Fresh produce delivered straight to doorstep',
      copy: `From harvesting room to your kitchen counter in Kadugodi and Whitefield within hours. Because true superfoods lose half their micronutrients after 48 hours of transit, we cut out distributors and delivery hubs entirely.`,
      illustration: 'delivery',
    },
  ];

  /** Organic blob clip-path classes */
  const blobClasses = ['blob-mask-1', 'blob-mask-2', 'blob-mask-3'];

  let reducedMotion = $state(false);
  let panelRefs = $state([]);
  let scrollTriggers = [];

  onMount(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mql.matches;

    if (reducedMotion) return;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        panelRefs.forEach((panel) => {
          if (!panel) return;

          const image = panel.querySelector('[data-story-image]');
          const illu = panel.querySelector('[data-story-illu]');

          const trigger = ScrollTrigger.create({
            trigger: panel,
            start: 'top 85%',
            once: true,
            onEnter: () => {
              gsap.fromTo(
                panel,
                { opacity: 0, y: 35 },
                { opacity: 1, y: 0, duration: 0.65, ease: 'power2.out' }
              );
            },
          });
          scrollTriggers.push(trigger);

          // Subtle parallax on photography
          if (image) {
            const parallax = gsap.to(image, {
              y: -18,
              ease: 'none',
              scrollTrigger: {
                trigger: panel,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.8,
              },
            });
            scrollTriggers.push(parallax.scrollTrigger);
          }

          if (illu) {
            gsap.fromTo(
              illu,
              { scale: 0.9, opacity: 0.4 },
              {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                scrollTrigger: {
                  trigger: panel,
                  start: 'top 80%',
                  once: true,
                },
              }
            );
          }
        });
      }
    );
  });

  onDestroy(() => {
    scrollTriggers.forEach((st) => st?.kill());
    scrollTriggers = [];
  });
</script>

<section data-section="story" class="relative px-5 py-16 bg-[#F7F7F2]/50 border-y border-[#E4E4DC]/60">
  <div class="mx-auto flex max-w-[430px] flex-col gap-14">
    <!-- Section Intro Header -->
    <div class="flex flex-col gap-2">
      <span class="text-xs font-bold uppercase tracking-widest text-[#2B5A16]">
        Farm To Doorstep
      </span>
      <h2
        class="text-[1.75rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
        style="font-family: 'Playfair Display', Georgia, serif;"
      >
        How Fresh Food Is Actually Supposed To Work
      </h2>
      <p class="text-[0.9rem] leading-relaxed text-[#4A5A52]">
        We don't stock warehouses. We grow directly in Kadugodi, harvest on order morning, and deliver straight to you.
      </p>
    </div>

    {#each panels as panel, i}
      <article
        bind:this={panelRefs[i]}
        class="flex flex-col gap-5 rounded-sm border border-[#E4E4DC] bg-white p-5 shadow-xs"
        class:opacity-0={!reducedMotion}
        style={!reducedMotion ? 'transform: translateY(35px)' : ''}
      >
        <!-- Header row with custom flat illustration -->
        <div class="flex items-center justify-between gap-3 border-b border-[#E4E4DC] pb-3">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#2B5A16]">
            {panel.stage}
          </span>

          <!-- Custom Flat Illustration in Brand Colors -->
          <div data-story-illu class="h-10 w-10 flex items-center justify-center rounded-sm bg-[#A8D632]/15 text-[#2B5A16]">
            {#if panel.illustration === 'growing'}
              <!-- Mushroom cultivation illustration -->
              <svg viewBox="0 0 32 32" fill="none" class="h-6 w-6">
                <path d="M7 19C7 13 11 9 16 9C21 9 25 13 25 19H7Z" fill="#A8D632" />
                <path d="M14 19V26H18V19" fill="#2B5A16" />
                <circle cx="12" cy="14" r="1.5" fill="#2B5A16" />
                <circle cx="19" cy="15" r="1.5" fill="#2B5A16" />
                <path d="M5 26H27" stroke="#2B5A16" stroke-width="2" stroke-linecap="round" />
              </svg>
            {:else if panel.illustration === 'harvest'}
              <!-- Morning harvest hands & basket illustration -->
              <svg viewBox="0 0 32 32" fill="none" class="h-6 w-6">
                <path d="M8 12L10 24H22L24 12H8Z" fill="#A8D632" />
                <path d="M16 6V12M12 8L16 12L20 8" stroke="#2B5A16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="16" cy="18" r="3" fill="#2B5A16" />
              </svg>
            {:else}
              <!-- Doorstep fast delivery illustration -->
              <svg viewBox="0 0 32 32" fill="none" class="h-6 w-6">
                <rect x="6" y="8" width="20" height="15" rx="1" fill="#A8D632" />
                <path d="M6 13H26" stroke="#2B5A16" stroke-width="2" />
                <path d="M16 8V23" stroke="#2B5A16" stroke-width="2" />
                <circle cx="11" cy="26" r="2.5" fill="#2B5A16" />
                <circle cx="21" cy="26" r="2.5" fill="#2B5A16" />
              </svg>
            {/if}
          </div>
        </div>

        <!-- Organic blob masked image -->
        <div class="relative overflow-hidden py-1" data-story-image>
          <img
            src={panel.image}
            alt={panel.alt}
            class="aspect-[16/10] w-full object-cover {blobClasses[i]} shadow-xs"
            loading="lazy"
          />
        </div>

        <!-- Narrative Copy -->
        <div class="flex flex-col gap-2">
          <h3
            class="text-[1.35rem] font-bold leading-snug tracking-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            {panel.heading}
          </h3>
          <p class="text-[0.9rem] leading-relaxed text-[#4A5A52]">
            {panel.copy}
          </p>
        </div>
      </article>
    {/each}
  </div>
</section>
