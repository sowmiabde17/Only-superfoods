<!--
  FloatingDownArrow.svelte — Floating Quick Scroll Button
  Matches Design Reference (Image 2):
  - Dark circular button at bottom right with downward arrow
  - Smoothly scrolls down to explore more sections or returns to top when near bottom
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';

  let isNearBottom = $state(false);

  function handleScroll() {
    if (typeof window === 'undefined') return;
    const scrollPos = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - 300;
    isNearBottom = scrollPos >= threshold;
  }

  function handleClick() {
    if (typeof window === 'undefined') return;
    if (isNearBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    }
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', handleScroll);
    }
  });
</script>

<div class="fixed bottom-20 left-4 z-30">
  <button
    onclick={handleClick}
    class="flex h-11 w-11 items-center justify-center rounded-full bg-[#3D4742] text-white shadow-lg transition-transform hover:scale-105 active:scale-95 press"
    aria-label={isNearBottom ? 'Scroll to top' : 'Scroll down'}
  >
    <svg
      class="h-5 w-5 transition-transform duration-300 {isNearBottom ? 'rotate-180' : ''}"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19 12 12 19 5 12"></polyline>
    </svg>
  </button>
</div>

