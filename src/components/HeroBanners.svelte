<!--
  HeroBanners.svelte — Feature Hero Banners
  Matches Design Reference:
  - Top Full-Width Hero Card: "Grey Oyster Mushrooms" + "FARM FRESH" badge
  - Split 2-Column Cards: "Microgreens" & "Kombucha"
  Svelte 5 runes mode.
-->
<script>
  function scrollToProduce(category = "all") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("osf:filter-category", { detail: { category } }),
      );
    }
    const target = document.querySelector('[data-section="products"]');
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }
</script>

<section data-section="hero" class="w-full bg-white px-4 py-3">
  <div class="mx-auto flex max-w-[440px] flex-col gap-3">
    <!-- ═══ 1. Main Featured Banner: Grey Oyster Mushrooms ═══ -->
    <div
      class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#143922] via-[#1a4a2c] to-[#12331e] p-5 text-white shadow-sm"
    >
      <!-- Circular "FARM FRESH" Badge on top right (exact match to design) -->
      <div
        class="absolute -right-1 -top-1 flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-[#FF5E00] text-center p-2 shadow-md transform rotate-6 z-10"
      >
        <span
          class="text-[9.5px] sm:text-[10px] font-black uppercase leading-tight tracking-wider text-white"
        >
          FARM<br />FRESH
        </span>
      </div>

      <!-- Content Layout -->
      <div
        class="relative z-10 flex flex-col justify-between min-h-[160px] max-w-[210px] sm:max-w-[240px]"
      >
        <div class="space-y-1">
          <span
            class="block text-[10px] font-bold uppercase tracking-widest text-[#A8D632]"
          >
            HARVESTED LOCALLY
          </span>
          <h3
            class="text-[1.65rem] sm:text-[1.85rem] font-bold leading-tight tracking-tight text-white"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Grey Oyster<br />Mushrooms
          </h3>
          <p class="text-xs text-white/80 pt-0.5">
            Tender. Nutritious. Versatile.
          </p>
        </div>

        <!-- "Shop Mushrooms ->" Pill Button -->
        <button
          onclick={() => scrollToProduce("Mushrooms")}
          class="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0B1F2E] shadow-sm hover:bg-[#F7F7F2] press"
        >
          <span>Shop Mushrooms</span>
          <span class="text-xs">→</span>
        </button>
      </div>

      <!-- Right Side Photo Asset with gradient fade -->
      <div
        class="absolute -bottom-2 -right-4 h-full w-[52%] overflow-hidden pointer-events-none"
      >
        <img
          src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/oyster%20banner.webp"
          alt="Fresh grey oyster mushrooms"
          class="h-full w-full object-cover object-right"
          loading="eager"
        />
        <!-- Seamless gradient fade into card background -->
        <div
          class="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#1a4a2c] to-transparent"
        ></div>
      </div>
    </div>

    <!-- ═══ 2. Split 2-Column Feature Cards ═══ -->
    <div class="grid grid-cols-2 gap-3">
      <!-- Left Card: Microgreens (Mint Background) -->
      <div
        class="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#EBF5E4] p-4 min-h-[185px] border border-[#D7E8CE] shadow-2xs"
      >
        <div class="relative z-10 space-y-1">
          <span
            class="block text-[9px] font-bold uppercase tracking-wider text-[#2B5A16]"
          >
            LIVING NUTRITION
          </span>
          <h4
            class="text-[1.25rem] font-bold leading-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Microgreens
          </h4>
          <p class="text-[11px] leading-tight text-[#4A5A52]">
            Small greens.<br />Big benefits.
          </p>
        </div>

        <button
          onclick={() => scrollToProduce("Microgreens")}
          class="relative z-10 mt-3 inline-flex items-center gap-1 self-start rounded-full bg-[#D4EABF] border border-[#BED9A4] px-3 py-1.5 text-[11px] font-bold text-[#2B5A16] hover:bg-[#c6e4ae] press"
        >
          <span>Shop Now</span>
          <span class="text-[10px]">→</span>
        </button>

        <!-- Microgreens Photo -->
        <div
          class="absolute -bottom-1 -right-2 h-24 w-24 overflow-hidden pointer-events-none"
        >
          <img
            src="/images/banner-microgreens.jpg"
            alt="Living microgreens"
            class="h-full w-full rounded-tl-xl object-cover"
            loading="lazy"
          />
        </div>
      </div>

      <!-- Right Card: Kombucha (Peach/Apricot Background) -->
      <div
        class="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#FDF1E2] p-4 min-h-[185px] border border-[#F6DEC3] shadow-2xs"
      >
        <div class="relative z-10 space-y-1">
          <span
            class="block text-[9px] font-bold uppercase tracking-wider text-[#B85000]"
          >
            NATURAL &amp; REFRESHING
          </span>
          <h4
            class="text-[1.25rem] font-bold leading-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Kombucha
          </h4>
          <p class="text-[11px] leading-tight text-[#4A5A52]">
            Live probiotics for<br />a healthier you.
          </p>
        </div>

        <button
          onclick={() => scrollToProduce("Kombucha")}
          class="relative z-10 mt-3 inline-flex items-center gap-1 self-start rounded-full bg-[#FCD8B6] border border-[#F2C296] px-3 py-1.5 text-[11px] font-bold text-[#943D00] hover:bg-[#fad0a6] press"
        >
          <span>Shop Now</span>
          <span class="text-[10px]">→</span>
        </button>

        <!-- Kombucha Photo (Enlarged visibility) -->
        <div
          class="absolute -bottom-1 -right-1 h-28 w-28 sm:h-32 sm:w-32 overflow-hidden pointer-events-none drop-shadow-sm"
        >
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp"
            alt="Cold artisan kombucha"
            class="h-full w-full rounded-tl-2xl object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </div>
</section>
