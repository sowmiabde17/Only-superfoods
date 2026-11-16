<!--
  DesktopDeliveryZone.svelte — Side-by-side interactive East Bengaluru Delivery Radar (1024px+ only)
  Left: Full-height OpenStreetMap Leaflet Radar (isolated z-0 stacking context, marching dashed border & animated van)
  Right: Searchable 60+ locality directory, dawn drop hours, and WhatsApp coordinate assistance
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { site } from '../../data/site.js';
  import {
    CORE_POLYGON_COORDS,
    EXTENDED_BUFFER_POLYGON,
    FARM_HUB_COORDS,
  } from '../../lib/geo.js';

  let mapContainer = $state(null);
  let mapInstance = null;
  let isMapLoading = $state(true);
  let areaSearch = $state('');
  let animFrameId = null;
  let resizeObserver = null;

  const allCoveredAreas = [
    'AECS Layout', 'Avalahalli', 'Balagere', 'Bandapura', 'Belthur', 'Bhaktarahalli',
    'Bidare Agrahara', 'Brookefield', 'Channasandra', 'Chikka Gattiganabbe', 'Chimasandra',
    'Devasandra', 'Doddabanahalli', 'Doddagattinagabbe', 'Doddanekundi', 'Garudachar Palya',
    'Goravigere', 'Gunjur', 'Hagadur', 'Harohalli', 'Hoodi', 'Hoskote', 'Huskuru',
    'Immadihalli', 'ITPL', 'Kadugodi (Farm Hub)', 'Kannamangala', 'Kattamanallur',
    'K Dommasandra', 'Kodigehalli', 'Konadasapura', 'Koralur', 'KR Puram', 'Kumbena Agrahara',
    'Kundalahalli', 'Mahadevapura', 'Mallasandra', 'Marathahalli', 'Medahalli', 'Munnekollal',
    'Naganayakanakote', 'Nagondanahalli', 'Panathur', 'Pattanduru Agrahara', 'Pettanahalli',
    'Ramagondanahalli', 'Ramamurthy Nagar', 'Sadaramangala', 'Samethanahalli',
    'Sarkara Guttahalli', 'Seegehalli', 'Seetharampalya', 'Siddapura', 'Sonnenahalli',
    'TC Palya', 'Thimmanahalli', 'Thirumalashettihalli', 'Valepura', 'Valepura Dinne',
    'Varthur', 'Whitefield',
  ];

  let filteredAreas = $derived.by(() => {
    const q = areaSearch.trim().toLowerCase();
    if (!q) return allCoveredAreas;
    return allCoveredAreas.filter((a) => a.toLowerCase().includes(q));
  });

  async function initMapIfReady() {
    if (mapInstance || !mapContainer || typeof window === 'undefined') return;
    if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) return;

    try {
      const L = (await import('leaflet')).default;

      mapInstance = L.map(mapContainer, {
        center: [12.995, 77.742],
        zoom: 12,
        minZoom: 11,
        maxZoom: 16,
        scrollWheelZoom: false,
        attributionControl: false,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstance);

      L.polygon(EXTENDED_BUFFER_POLYGON, {
        stroke: true,
        color: '#84CC16',
        dashArray: '8, 8',
        weight: 2,
        fillColor: '#BEF264',
        fillOpacity: 0.14,
      }).addTo(mapInstance);

      const corePolygon = L.polygon(CORE_POLYGON_COORDS, {
        stroke: true,
        color: '#2B5A16',
        dashArray: '10, 6',
        weight: 2.5,
        fillColor: '#74C043',
        fillOpacity: 0.25,
      }).addTo(mapInstance);

      mapInstance.fitBounds(corePolygon.getBounds(), { padding: [24, 24] });

      const farmIcon = L.divIcon({
        className: 'desktop-farm-hub-marker',
        html: `<div style="background:#143922; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:3px solid #A8D632; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-size:16px;">🌱</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker(FARM_HUB_COORDS, { icon: farmIcon })
        .addTo(mapInstance)
        .bindPopup('<strong>🌱 Only Superfoods Farm Hub</strong><br/>Kadugodi, Bangalore 560067');

      // Animated van traveling along core perimeter
      const vanIcon = L.divIcon({
        className: 'desktop-van-marker',
        html: `<div style="background:#fff; border:2px solid #2B5A16; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.25); font-size:14px;">🚚</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const vanMarker = L.marker(CORE_POLYGON_COORDS[0], { icon: vanIcon }).addTo(mapInstance);

      let progress = 0;
      const animateVan = () => {
        progress = (progress + 0.00055) % 1;
        const pts = CORE_POLYGON_COORDS;
        const totalSegs = pts.length - 1;
        const exactIdx = progress * totalSegs;
        const i = Math.floor(exactIdx);
        const frac = exactIdx - i;
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        if (p1 && p2) {
          vanMarker.setLatLng([
            p1[0] + (p2[0] - p1[0]) * frac,
            p1[1] + (p2[1] - p1[1]) * frac,
          ]);
        }
        animFrameId = requestAnimationFrame(animateVan);
      };
      animFrameId = requestAnimationFrame(animateVan);

      isMapLoading = false;
    } catch (e) {
      console.warn('Desktop map init notice:', e);
      isMapLoading = false;
    }
  }

  onMount(() => {
    initMapIfReady();
    if (typeof ResizeObserver !== 'undefined' && mapContainer) {
      resizeObserver = new ResizeObserver(() => {
        if (!mapInstance) initMapIfReady();
        else mapInstance.invalidateSize();
      });
      resizeObserver.observe(mapContainer);
    }
  });

  onDestroy(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (resizeObserver) resizeObserver.disconnect();
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });
</script>

<section id="desktop-delivery" class="w-full scroll-mt-20 bg-white py-20 border-b border-[#E4E4DC]">
  <div id="delivery" class="relative -top-24"></div>
  <div class="mx-auto max-w-[1280px] px-8">
    <!-- Section Header -->
    <div class="mb-10 flex items-end justify-between gap-6">
      <div>
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#2B5A16]">
          Hyper-Local Cold-Chain Network
        </span>
        <h2
          class="mt-1.5 text-3xl xl:text-4xl font-bold tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          East Bengaluru Dawn Delivery Radar
        </h2>
      </div>
      <div class="rounded-full bg-[#FAF7F0] border border-[#E4E4DC] px-4 py-2 text-xs font-bold text-[#2B5A16]">
        🌅 Strict Morning Drop: 7:00 AM – 10:00 AM Daily
      </div>
    </div>

    <!-- Side-by-Side 12-Col Layout -->
    <div class="grid grid-cols-12 gap-8 items-stretch">
      <!-- Left 7 Cols: Isolated Interactive Leaflet Map -->
      <div class="col-span-7 flex flex-col overflow-hidden rounded-3xl border border-[#E4E4DC] bg-[#FAFBF7] shadow-sm">
        <div class="relative isolate z-0 flex-1 min-h-[450px] w-full">
          <div class="absolute left-4 top-4 z-[400] flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm border border-[#E4E4DC] backdrop-blur-xs">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8DC63F] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2B5A16]"></span>
            </span>
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-[#0B1F2E]">
              LIVE ROUTE • WHITEFIELD, KADUGODI &amp; EAST BLR
            </span>
          </div>

          <div
            bind:this={mapContainer}
            class="h-full w-full min-h-[450px] bg-[#E5E9DF]"
            role="region"
            aria-label="Desktop East Bengaluru Delivery Zone Map"
          >
            {#if isMapLoading}
              <div class="flex h-full w-full items-center justify-center text-xs text-[#4A5A52]">
                Loading OpenStreetMap East Bengaluru Radar...
              </div>
            {/if}
          </div>
        </div>

        <!-- Legend Bar -->
        <div class="flex items-center justify-around border-t border-[#E4E4DC] bg-white px-6 py-3 text-xs text-[#4A5A52]">
          <div class="flex items-center gap-2">
            <span class="inline-block h-3 w-4 rounded-xs bg-[#74C043] border border-[#2B5A16]"></span>
            <span class="font-bold text-[#0B1F2E]">Core Express Zone (Free Drop)</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block h-3 w-4 rounded-xs border border-dashed border-[#84CC16] bg-[#BEF264]/40"></span>
            <span class="font-bold text-[#0B1F2E]">2 km Extended Buffer</span>
          </div>
          <div class="flex items-center gap-1.5 font-semibold text-[#2B5A16]">
            <span>🌱 Kadugodi Farm Hub</span>
          </div>
        </div>
      </div>

      <!-- Right 5 Cols: Locality Search & Quick Check -->
      <div class="col-span-5 flex flex-col justify-between rounded-3xl border border-[#E1EAD2] bg-gradient-to-b from-[#FAFBF7] to-[#F3F7EC] p-7 shadow-2xs space-y-5">
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3
              class="text-xl font-bold text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              60+ Localities Covered
            </h3>
            <span class="rounded-full bg-[#E2F0D0] px-2.5 py-1 text-[10px] font-extrabold text-[#2B5A16]">
              Same-Morning
            </span>
          </div>

          <input
            type="search"
            bind:value={areaSearch}
            placeholder="Search your layout or apartment (e.g. Hoodi, ITPL)..."
            class="w-full rounded-xl border border-[#D4E3C5] bg-white px-4 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#2B5A16] shadow-2xs"
          />

          <!-- Scrollable Multi-Col Locality Chips -->
          <div class="max-h-[245px] overflow-y-auto pr-1 grid grid-cols-2 gap-1.5">
            {#each filteredAreas as area}
              <div class="flex items-center gap-1.5 rounded-lg bg-white/80 border border-[#E4E4DC]/80 px-2.5 py-1.5 text-[11px] font-medium text-[#0B1F2E]">
                <span class="h-1.5 w-1.5 rounded-full bg-[#8DC632] shrink-0"></span>
                <span class="truncate">{area}</span>
              </div>
            {:else}
              <div class="col-span-2 py-6 text-center text-xs text-[#4A5A52]">
                No direct match for "{areaSearch}". Message us on WhatsApp—we often cover nearby apartment clusters!
              </div>
            {/each}
          </div>
        </div>

        <!-- Outside Zone CTA Card -->
        <div class="rounded-2xl border border-[#A8D632]/40 bg-white p-4 flex items-center justify-between gap-4">
          <div>
            <div class="text-xs font-bold text-[#0B1F2E]">Just outside the zone?</div>
            <div class="text-[11px] text-[#4A5A52]">Send your pin on WhatsApp for custom morning routes.</div>
          </div>
          <a
            href={`${site.whatsapp.link}?text=${encodeURIComponent('Hi Only Superfoods! Can you confirm morning delivery coverage for my East Bengaluru location?')}`}
            target="_blank"
            rel="noopener noreferrer"
            class="shrink-0 rounded-full bg-[#25D366] hover:bg-[#1ebd5a] px-4 py-2 text-xs font-bold text-white transition-colors press"
          >
            Check via WhatsApp
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

