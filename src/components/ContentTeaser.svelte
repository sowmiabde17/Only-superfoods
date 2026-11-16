<!--
  ContentTeaser.svelte — Homepage teaser strip for recipes
  Horizontal scrollable strip of VideoCards + "See all" link.
  Svelte 5 runes mode.
-->
<script>
  import { onMount } from 'svelte';
  import { recipes } from '../data/recipes.js';
  import VideoCard from './VideoCard.svelte';

  // Show first 4 recipes on homepage
  const teaserRecipes = recipes.slice(0, 4);

  let sectionRef = $state(null);

  onMount(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mql.matches) return;

    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        gsap.fromTo(
          sectionRef,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: sectionRef,
              start: 'top 85%',
              once: true,
            },
          }
        );
      });
    });
  });
</script>

<section
  bind:this={sectionRef}
  data-section="content"
  class="py-14"
>
  <div class="mx-auto max-w-[430px] px-5">
    <h2
      class="mb-1 text-[1.5rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
      style="font-family: 'Playfair Display', serif;"
    >
      Cook Something New
    </h2>
    <p class="mb-5 text-[0.875rem] text-[#4A5A52]">
      Simple recipes that make our produce shine.
    </p>
  </div>

  <!-- Horizontal scroll strip -->
  <div class="overflow-x-auto no-scrollbar">
    <div class="flex gap-3 px-5 pb-2 snap-x snap-mandatory" style="min-width: max-content;">
      {#each teaserRecipes as recipe (recipe.id)}
        <VideoCard {recipe} />
      {/each}
    </div>
  </div>

  <div class="mx-auto max-w-[430px] px-5 mt-4">
    <a
      href="/recipes"
      class="inline-flex items-center gap-1 text-sm font-medium text-[#2B5A16] hover:text-[#A8D632] transition-colors"
    >
      See all recipes
      <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
      </svg>
    </a>
  </div>
</section>

