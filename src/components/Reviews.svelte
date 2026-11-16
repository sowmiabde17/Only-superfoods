<!--
  Reviews.svelte — Swipeable review carousel section
  Horizontal scroll-snap carousel with dot indicators.
  Svelte 5 runes mode.
-->
<script>
  import { onMount } from 'svelte';
  import { reviews } from '../data/reviews.js';
  import ReviewCard from './ReviewCard.svelte';

  let scrollContainer = $state(null);
  let activeIndex = $state(0);
  let sectionRef = $state(null);

  function handleScroll() {
    if (!scrollContainer) return;
    const cardWidth = 280 + 12; // card width + gap
    const scrollLeft = scrollContainer.scrollLeft;
    activeIndex = Math.round(scrollLeft / cardWidth);
  }

  function scrollToIndex(index) {
    if (!scrollContainer) return;
    const cardWidth = 280 + 12;
    scrollContainer.scrollTo({
      left: cardWidth * index,
      behavior: 'smooth',
    });
  }

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
  data-section="reviews"
  class="py-14"
>
  <div class="mx-auto max-w-[430px] px-5">
    <h2
      class="mb-5 text-[1.5rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
      style="font-family: 'Playfair Display', serif;"
    >
      What People Say
    </h2>
  </div>

  <!-- Horizontal swipeable carousel -->
  <div
    bind:this={scrollContainer}
    onscroll={handleScroll}
    class="flex gap-3 overflow-x-auto px-5 pb-4 no-scrollbar snap-x snap-mandatory"
  >
    {#each reviews as review (review.id)}
      <ReviewCard {review} />
    {/each}
  </div>

  <!-- Dot indicators -->
  <div class="mt-3 flex justify-center gap-1.5">
    {#each reviews as _, i}
      <button
        onclick={() => scrollToIndex(i)}
        class="h-1.5 rounded-full transition-all duration-300
               {activeIndex === i
                 ? 'w-4 bg-[#A8D632]'
                 : 'w-1.5 bg-[#E4E4DC]'}"
        aria-label="Go to review {i + 1}"
      ></button>
    {/each}
  </div>
</section>

