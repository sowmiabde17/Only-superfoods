<!--
  DesktopBentoShowcase.svelte — Asymmetric 4-category editorial Bento grid (1024px+ only)
  Replaces mobile stacked CategoryBar/HeroBanners/BestSellers with cohesive visual discovery.
  Svelte 5 runes mode.
-->
<script>
  function filterAndScroll(category) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('osf:filter-category', { detail: { category } }));
    }
    const target = document.querySelector('#desktop-catalog');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
</script>

<section class="w-full bg-white py-16 border-b border-[#E4E4DC]/70">
  <div class="mx-auto max-w-[1280px] px-8">
    <!-- Section Heading -->
    <div class="mb-9 flex items-end justify-between gap-6">
      <div>
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Our Goodness • Four Living Pillars
        </span>
        <h2
          class="mt-1.5 text-3xl xl:text-4xl font-bold tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Explore Our Farm-Fresh Collection
        </h2>
      </div>

      <button
        type="button"
        onclick={() => filterAndScroll('all')}
        class="inline-flex items-center gap-2 rounded-full border border-[#E4E4DC] bg-[#FAF7F0] px-5 py-2.5 text-xs font-bold text-[#0B1F2E] hover:border-[#2B5A16] hover:bg-[#F2F8EA] transition-colors press"
      >
        <span>Browse All Harvest Items</span>
        <span>→</span>
      </button>
    </div>

    <!-- Bento Grid: Large Feature Left + 3 Balanced Tiles Right -->
    <div class="grid grid-cols-12 gap-5">
      <!-- Tile 1 (Large Left: Oyster Mushrooms) -->
      <button
        type="button"
        onclick={() => filterAndScroll('Mushrooms')}
        class="col-span-6 relative overflow-hidden rounded-3xl bg-[#143922] p-8 text-left text-white shadow-sm group min-h-[380px] flex flex-col justify-between transition-all hover:shadow-xl"
      >
        <img
          src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/oyster%20banner.webp"
          alt="Grey and Pink Oyster Mushrooms"
          class="absolute inset-0 h-full w-full object-cover opacity-65 transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
        <div class="absolute inset-0 bg-gradient-to-r from-[#0F2C1A]/95 via-[#143922]/75 to-transparent"></div>

        <div class="relative z-10 max-w-sm space-y-3">
          <span class="inline-block rounded-full bg-[#A8D632] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#0B1F2E]">
            Bestseller Harvest
          </span>
          <h3
            class="text-3xl font-bold leading-tight text-white"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Grey, Pink &amp; Medley<br />Oyster Mushrooms
          </h3>
          <p class="text-sm text-white/85 leading-relaxed">
            Velvet gourmet clusters grown on organic hardwood sawdust. High in ergothioneine &amp; prebiotic beta-glucans.
          </p>
        </div>

        <div class="relative z-10 flex items-center gap-3 pt-4">
          <span class="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-[#0B1F2E] shadow-sm group-hover:bg-[#A8D632] transition-colors">
            Shop Mushrooms →
          </span>
          <span class="text-xs font-medium text-white/80">3 Varieties • From ₹100</span>
        </div>
      </button>

      <!-- Right Side Column (2-Row Bento) -->
      <div class="col-span-6 grid grid-cols-2 gap-5">
        <!-- Tile 2 (Top Full Span: Living Microgreens) -->
        <button
          type="button"
          onclick={() => filterAndScroll('Microgreens')}
          class="col-span-2 relative overflow-hidden rounded-3xl border border-[#D7E8CE] bg-[#EBF5E4] p-7 text-left group min-h-[180px] flex items-center justify-between transition-all hover:border-[#A8D632] hover:shadow-lg"
        >
          <div class="relative z-10 max-w-xs space-y-2">
            <span class="block text-[10px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
              Living Nutrition
            </span>
            <h3
              class="text-2xl font-bold text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              Sunflower &amp; Radish Microgreens
            </h3>
            <p class="text-xs text-[#4A5A52] leading-relaxed">
              Clipped at dawn with up to 40× nutrient density over mature greens.
            </p>
            <span class="inline-flex items-center gap-1.5 pt-1 text-xs font-extrabold text-[#2B5A16] group-hover:translate-x-1 transition-transform">
              Explore Microgreens →
            </span>
          </div>

          <div class="relative h-36 w-52 shrink-0 overflow-hidden rounded-2xl border border-white shadow-sm">
            <img
              src="/images/banner-microgreens.jpg"
              alt="Fresh living microgreens"
              class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </button>

        <!-- Tile 3 (Bottom-Left: Kombucha) -->
        <button
          type="button"
          onclick={() => filterAndScroll('Kombucha')}
          class="col-span-1 relative overflow-hidden rounded-3xl border border-[#F2DFC2] bg-[#FFF5EA] p-6 text-left group min-h-[190px] flex flex-col justify-between transition-all hover:border-[#E69D45] hover:shadow-lg"
        >
          <div class="space-y-1.5 relative z-10 pr-28">
            <span class="block text-[10px] font-extrabold uppercase tracking-widest text-[#A65400]">
              Gut Health Elixir
            </span>
            <h3
              class="text-xl font-bold text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              Raw Kombucha
            </h3>
            <p class="text-[11px] text-[#6B5036]">21-day fermented probiotics.</p>
          </div>
          <span class="relative z-10 text-xs font-extrabold text-[#A65400] group-hover:translate-x-1 transition-transform">
            Shop Kombucha →
          </span>
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp"
            alt="Artisanal Raw Kombucha"
            class="absolute -bottom-2 -right-2 h-36 w-36 sm:h-40 sm:w-40 rounded-2xl object-cover border-2 border-white shadow-md transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </button>

        <!-- Tile 4 (Bottom-Right: Free-Range Desi Eggs) -->
        <button
          type="button"
          onclick={() => filterAndScroll('Desi Eggs')}
          class="col-span-1 relative overflow-hidden rounded-3xl border border-[#E4E4DC] bg-[#FAF7F0] p-6 text-left group min-h-[190px] flex flex-col justify-between transition-all hover:border-[#A8D632] hover:shadow-lg"
        >
          <div class="space-y-1.5 relative z-10 pr-28">
            <span class="block text-[10px] font-extrabold uppercase tracking-widest text-[#2B5A16]">
              Pasture Raised
            </span>
            <h3
              class="text-xl font-bold text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              Desi Eggs
            </h3>
            <p class="text-[11px] text-[#4A5A52]">Rich amber Omega-3 yolks.</p>
          </div>
          <span class="relative z-10 text-xs font-extrabold text-[#2B5A16] group-hover:translate-x-1 transition-transform">
            Shop Desi Eggs →
          </span>
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp"
            alt="Free-Range Desi Eggs"
            class="absolute -bottom-2 -right-2 h-36 w-36 sm:h-40 sm:w-40 rounded-2xl object-cover border-2 border-white shadow-md transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </button>
      </div>
    </div>
  </div>
</section>

