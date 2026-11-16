<!--
  DesktopHero.svelte — Full-width editorial farm-to-table split hero (1024px+ only)
  Features Playfair Display headline, live harvest stats, primary/secondary CTAs,
  and widescreen 16:9 harvest photography with interactive floating highlight card.
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { getProducts } from '../../lib/productsStore.js';
  import { site } from '../../data/site.js';

  function openQuickView(product) {
    if (typeof window !== 'undefined' && product) {
      window.dispatchEvent(new CustomEvent('osf:open-product-quickview', { detail: { product } }));
    }
  }

  let spotlightProduct = $state(null);

  function refreshSpotlight() {
    const all = getProducts();
    spotlightProduct = all.find((p) => p.id === 'grey-oyster') || all[0] || null;
  }

  function handleProductsUpdated() {
    refreshSpotlight();
  }

  onMount(() => {
    refreshSpotlight();
    window.addEventListener('osf:products-updated', handleProductsUpdated);
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('osf:products-updated', handleProductsUpdated);
    }
  });

  function scrollToCatalog(category = 'all') {
    if (typeof window !== 'undefined' && category !== 'all') {
      window.dispatchEvent(new CustomEvent('osf:filter-category', { detail: { category } }));
    }
    const el = document.querySelector('#desktop-catalog');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
</script>

<section class="relative w-full overflow-hidden bg-gradient-to-br from-[#FAF7F0] via-[#FAF7F0] to-[#EFF5E4] border-b border-[#E4E4DC]">
  <!-- Ambient soft radial accents -->
  <div class="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#A8D632]/15 blur-3xl"></div>
  <div class="pointer-events-none absolute -bottom-24 right-12 h-96 w-96 rounded-full bg-[#2B5A16]/10 blur-3xl"></div>

  <div class="relative mx-auto max-w-[1280px] px-8 py-14 xl:py-20">
    <div class="grid grid-cols-12 items-center gap-12">
      <!-- Left Column: Editorial Narrative & CTAs -->
      <div class="col-span-6 space-y-7">
        <!-- Farm Eyebrow -->
        <div class="inline-flex items-center gap-2 rounded-full border border-[#D4E3C5] bg-white/90 px-4 py-1.5 shadow-2xs">
          <span class="h-2 w-2 rounded-full bg-[#2B5A16]"></span>
          <span class="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2B5A16]">
            Kadugodi Indoor Farm • Harvested 5:30 AM Daily
          </span>
        </div>

        <!-- Hero Headline -->
        <div class="space-y-4">
          <h1
            class="text-[3.1rem] xl:text-[3.85rem] font-black leading-[1.06] tracking-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Living Superfoods,<br />
            Picked at Dawn.
          </h1>
          <p class="max-w-xl text-base xl:text-[1.08rem] leading-relaxed text-[#4A5A52]">
            Velvet oyster mushrooms, 40× nutrient-dense living microgreens, 21-day raw kombucha, and pasture-foraged desi eggs. Zero cold storage—harvested in Kadugodi and delivered straight to East Bengaluru kitchens before 10:00 AM.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center gap-4 pt-1">
          <button
            type="button"
            onclick={() => scrollToCatalog('all')}
            class="inline-flex items-center gap-2.5 rounded-full bg-[#143922] hover:bg-[#1E5030] px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all press"
          >
            <span>Shop Morning Harvest</span>
            <span aria-hidden="true">→</span>
          </button>

          <a
            href="/subscribe"
            class="inline-flex items-center gap-2 rounded-full border-2 border-[#2B5A16]/25 bg-white hover:border-[#2B5A16] px-6 py-3 text-sm font-bold text-[#2B5A16] transition-all press"
          >
            <span>Build Weekly Box</span>
          </a>

          <a
            href={site.whatsapp.link}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-xs font-bold text-[#4A5A52] hover:text-[#25D366] transition-colors px-2 py-2"
          >
            <span>💬 Direct WhatsApp</span>
          </a>
        </div>

        <!-- 3-Column Trust Metrics -->
        <div class="grid grid-cols-3 gap-6 border-t border-[#E4E4DC] pt-6">
          <div>
            <div class="text-xl font-black text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
              5:30 AM
            </div>
            <div class="text-xs font-medium text-[#4A5A52]">Daily harvest start before morning routes</div>
          </div>
          <div>
            <div class="text-xl font-black text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
              0 Sprays
            </div>
            <div class="text-xs font-medium text-[#4A5A52]">Chemical &amp; pesticide-free indoor rooms</div>
          </div>
          <div>
            <div class="text-xl font-black text-[#2B5A16]" style="font-family: 'Playfair Display', serif;">
              ★ 4.8 / 5
            </div>
            <div class="text-xs font-medium text-[#4A5A52]">Rated by Whitefield &amp; East BLR homes</div>
          </div>
        </div>
      </div>

      <!-- Right Column: Widescreen Editorial Visual Stage -->
      <div class="col-span-6 relative">
        <div class="relative overflow-hidden rounded-3xl border border-[#E4E4DC] bg-[#143922] shadow-2xl group">
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/hero%20.webp"
            alt="Freshly harvested oyster mushrooms, living microgreens, raw kombucha, and desi eggs at Only Superfoods"
            class="aspect-[16/11] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            loading="eager"
          />
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0B1F2E]/50 via-transparent to-transparent"></div>

          <!-- Top-Right Stamp -->
          <div class="absolute top-5 right-5 flex h-20 w-20 flex-col items-center justify-center rounded-full bg-[#FF5E00] text-center text-white shadow-lg rotate-6">
            <span class="text-[10px] font-black uppercase leading-tight tracking-wider">
              FARM<br />FRESH<br />5:30 AM
            </span>
          </div>

          <!-- Bottom Floating Live Spotlight Card -->
          {#if spotlightProduct}
            <div class="absolute bottom-5 left-5 right-5 flex items-center justify-between gap-4 rounded-2xl border border-white/25 bg-white/95 p-4 backdrop-blur-md shadow-xl">
              <div class="flex items-center gap-3.5 min-w-0">
                <img
                  src={spotlightProduct.image}
                  alt={spotlightProduct.name}
                  class="h-14 w-14 rounded-xl object-cover border border-[#E4E4DC] shrink-0"
                />
                <div class="min-w-0">
                  <div class="text-[10px] font-extrabold uppercase tracking-wider text-[#2B5A16]">
                    Tomorrow Dawn Drop (7–10 AM)
                  </div>
                  <div class="truncate text-sm font-bold text-[#0B1F2E]">
                    {spotlightProduct.name} · {spotlightProduct.unit}
                  </div>
                  <div class="text-xs font-semibold text-[#4A5A52]">
                    ₹{spotlightProduct.price} <span class="text-[#2B5A16]">• Harvested to order</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onclick={() => openQuickView(spotlightProduct)}
                class="shrink-0 rounded-full bg-[#143922] hover:bg-[#2B5A16] px-4 py-2 text-xs font-bold text-white transition-colors press"
              >
                Quick View →
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>
