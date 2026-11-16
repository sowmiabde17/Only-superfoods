<!--
  DeliveryZoneChecker.svelte — Hyper-Local Bangalore Delivery Network
  Features:
  - Official OpenStreetMap (100% Open Source, Zero API Key / Watermark)
  - Animated Running Dashed Border ("ifen like" marching lines along the perimeter)
  - Animated Delivery Van traveling smoothly in a continuous slow loop around the boundary
  - Clean map (cluttered bullseye circles removed; clean Kadugodi Farm Hub retained)
  - Playful delivery badge & funny vehicle popup
  - Single Bucket: 60+ villages & layouts in 3-lane format with quick search
  - 1-click WhatsApp order CTA & expansion banner
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { site } from '../data/site.js';
  import { CORE_POLYGON_COORDS, EXTENDED_BUFFER_POLYGON } from '../lib/geo.js';

  /* ── State ──────────────────────────────────────── */
  let mapContainer = $state(null);
  let mapInstance = null;
  let isMapLoading = $state(true);
  let areaSearch = $state('');
  let isExpanded = $state(false);
  let animFrameId = null;

  /* ── Polygon Coordinates for East Bengaluru Radar (Single Source of Truth) ── */
  const polygonCoords = CORE_POLYGON_COORDS;

  /* ── All 60 Villages & Localities in Marked Polygon Radar (Single Bucket) ── */
  const allCoveredAreas = [
    'AECS Layout',
    'Avalahalli',
    'Balagere',
    'Bandapura',
    'Belthur',
    'Bhaktarahalli',
    'Bidare Agrahara',
    'Brookefield',
    'Channasandra',
    'Chikka Gattiganabbe',
    'Chimasandra',
    'Devasandra',
    'Doddabanahalli',
    'Doddagattinagabbe',
    'Doddanekundi',
    'Garudachar Palya',
    'Goravigere',
    'Gunjur',
    'Hagadur',
    'Harohalli',
    'Hoodi',
    'Hoskote',
    'Huskuru',
    'Immadihalli',
    'ITPL',
    'Kadugodi (Farm Hub)',
    'Kannamangala',
    'Kattamanallur',
    'K Dommasandra',
    'Kodigehalli',
    'Konadasapura',
    'Koralur',
    'KR Puram',
    'Kumbena Agrahara',
    'Kundalahalli',
    'Mahadevapura',
    'Mallasandra',
    'Marathahalli',
    'Medahalli',
    'Munnekollal',
    'Naganayakanakote',
    'Nagondanahalli',
    'Panathur',
    'Pattanduru Agrahara',
    'Pettanahalli',
    'Ramagondanahalli',
    'Ramamurthy Nagar',
    'Sadaramangala',
    'Samethanahalli',
    'Sarkara Guttahalli',
    'Seegehalli',
    'Seetharampalya',
    'Siddapura',
    'Sonnenahalli',
    'TC Palya',
    'Thimmanahalli',
    'Thirumalashettihalli',
    'Valepura',
    'Valepura Dinne',
    'Varthur',
    'Whitefield',
  ];

  /* ── Filtered & Partitioned into 3 Lanes ── */
  let filteredAreas = $derived.by(() => {
    const q = areaSearch.trim().toLowerCase();
    if (!q) return allCoveredAreas;
    return allCoveredAreas.filter((a) => a.toLowerCase().includes(q));
  });

  let visibleAreas = $derived.by(() => {
    if (areaSearch.trim() || isExpanded) {
      return filteredAreas;
    }
    return filteredAreas.slice(0, 24);
  });

  let lane1 = $derived.by(() => {
    const total = visibleAreas.length;
    const perLane = Math.ceil(total / 3);
    return visibleAreas.slice(0, perLane);
  });

  let lane2 = $derived.by(() => {
    const total = visibleAreas.length;
    const perLane = Math.ceil(total / 3);
    return visibleAreas.slice(perLane, perLane * 2);
  });

  let lane3 = $derived.by(() => {
    const total = visibleAreas.length;
    const perLane = Math.ceil(total / 3);
    return visibleAreas.slice(perLane * 2);
  });

  /* ── Interpolate Points along Perimeter for Delivery Vehicle ── */
  let totalPerimeter = 0;
  const segments = [];
  for (let i = 0; i < polygonCoords.length; i++) {
    const p1 = polygonCoords[i];
    const p2 = polygonCoords[(i + 1) % polygonCoords.length];
    const dLat = p2[0] - p1[0];
    const dLng = p2[1] - p1[1];
    const dist = Math.hypot(dLat, dLng);
    segments.push({ p1, p2, dist });
    totalPerimeter += dist;
  }

  function getPositionAt(progress) {
    let target = (progress % 1) * totalPerimeter;
    let acc = 0;
    for (const seg of segments) {
      if (acc + seg.dist >= target) {
        const t = (target - acc) / seg.dist;
        const lat = seg.p1[0] + (seg.p2[0] - seg.p1[0]) * t;
        const lng = seg.p1[1] + (seg.p2[1] - seg.p1[1]) * t;
        const isHeadingWest = seg.p2[1] < seg.p1[1];
        return { lat, lng, isHeadingWest };
      }
      acc += seg.dist;
    }
    return { lat: polygonCoords[0][0], lng: polygonCoords[0][1], isHeadingWest: false };
  }

  /* ── Initialize Leaflet Map ─────────────────────── */
  onMount(async () => {
    if (typeof window === 'undefined') return;

    try {
      const L = (await import('leaflet')).default;

      if (!mapContainer) return;

      // Restrict bounds strictly to Bengaluru
      const southWest = L.latLng(12.82, 77.52);
      const northEast = L.latLng(13.15, 77.85);
      const bangaloreBounds = L.latLngBounds(southWest, northEast);

      mapInstance = L.map(mapContainer, {
        center: [13.000, 77.740],
        zoom: 12,
        minZoom: 11,
        maxZoom: 16,
        maxBounds: bangaloreBounds,
        maxBoundsViscosity: 1.0,
        scrollWheelZoom: false, // Prevents mobile page scroll trapping
        zoomControl: true,
        attributionControl: false, // Completely removes Leaflet attribution watermark & copyright link
      });

      // Official OpenStreetMap Tiles (100% Open Source, Free, Zero API Key / Watermark)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '',
      }).addTo(mapInstance);

      // 0. Extended 2 km Zone buffer layer (subtle dashed green band)
      L.polygon(EXTENDED_BUFFER_POLYGON, {
        stroke: true,
        color: '#84CC16',
        dashArray: '6, 6',
        weight: 1.8,
        fillColor: '#BEF264',
        fillOpacity: 0.14,
      }).addTo(mapInstance).bindTooltip(
        '<strong>Extended 2 km Zone</strong><br/>Deliveries available across neighboring areas 🌱',
        { sticky: true }
      );

      // 1. Semi-transparent rich green polygon fill with subtle solid boundary
      const zonePolygon = L.polygon(polygonCoords, {
        stroke: true,
        color: '#2B5A16',
        weight: 1.8,
        opacity: 0.9,
        fillColor: '#74C043',
        fillOpacity: 0.35,
      }).addTo(mapInstance);

      // Auto-fit bounds so the full extended delivery zone (Hoskote to Ramamurthy Nagar & Varthur) is framed perfectly
      mapInstance.fitBounds(zonePolygon.getBounds(), {
        padding: [16, 16],
        maxZoom: 13,
      });

      // 2. Animated Running Hyphenated Border ("ifen like" running lines)
      const animatedPerimeter = L.polyline([...polygonCoords, polygonCoords[0]], {
        color: '#1E3F20',
        weight: 3.5,
        dashArray: '12, 10',
        className: 'running-delivery-border',
      }).addTo(mapInstance);

      animatedPerimeter.bindTooltip(
        '<strong>Only Superfoods Hyper-Local Delivery Zone</strong><br/>🚚 Morning harvest deliveries daily (7 AM – 10 AM)',
        { sticky: true }
      );

      // 3. Kadugodi Farm Hub Marker
      const farmPin = L.divIcon({
        className: 'custom-farm-pin',
        html: `
          <div class="relative flex flex-col items-center">
            <div style="background:#2B5A16; border:2.5px solid #ffffff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:16px;">
              🌱
            </div>
            <div style="background:#ffffff; border:1px solid #2B5A16; color:#2B5A16; font-size:9px; font-weight:800; padding:1px 5px; border-radius:4px; margin-top:2px; box-shadow:0 1px 3px rgba(0,0,0,0.15); white-space:nowrap;">
              Kadugodi Farm
            </div>
          </div>
        `,
        iconSize: [60, 48],
        iconAnchor: [30, 17],
      });

      L.marker([12.9982, 77.7609], { icon: farmPin })
        .addTo(mapInstance)
        .bindPopup(
          '<div style="font-family: inherit; font-size: 12px; line-height: 1.4; padding: 2px;">' +
            '<strong style="color: #2B5A16; font-size: 13px;">🌱 Only Superfoods Farm &amp; Packhouse</strong><br/>' +
            'Kadugodi, Bangalore 560067<br/>' +
            '<span style="color: #4A5A52; font-size: 11px;">Mushroom fruiting rooms &amp; microgreens farm hub</span>' +
          '</div>'
        );

      // 4. Moving Delivery Vehicle Marker
      const startPos = getPositionAt(0);
      const vehicleEl = document.createElement('div');
      vehicleEl.className = 'moving-vehicle-container';
      vehicleEl.innerHTML = `
        <div class="relative cursor-pointer select-none" id="van-vehicle-wrapper">
          <div style="background:#ffffff; border:2px solid #2B5A16; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.3); transition:transform 0.2s ease;">
            <span id="van-icon" style="font-size:18px; line-height:1; display:inline-block;">🚚</span>
          </div>
          <div style="position:absolute; top:-18px; left:50%; transform:translateX(-50%); background:#0B1F2E; color:#ffffff; font-size:8.5px; font-weight:800; padding:1px 6px; border-radius:10px; border:1px solid #A8D632; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
            Fresh Drop 💨
          </div>
        </div>
      `;

      const vanIcon = L.divIcon({
        className: 'delivery-van-icon',
        html: vehicleEl,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const vanMarker = L.marker([startPos.lat, startPos.lng], {
        icon: vanIcon,
        zIndexOffset: 1000,
      }).addTo(mapInstance);

      vanMarker.bindPopup(
        '<div style="font-family: inherit; font-size: 12px; line-height: 1.4; text-align: center; padding: 4px;">' +
          '<div style="font-size: 24px; margin-bottom: 2px;">🚚💨</div>' +
          '<strong style="color: #0B1F2E; font-size: 13px;">Only Superfoods Express!</strong><br/>' +
          '<span style="color: #2B5A16; font-weight: bold; font-size: 11px;">Cruising across the morning delivery route!</span><br/>' +
          '<span style="color: #666; font-size: 10.5px;">Beep beep! Same-morning drops 7 AM – 10 AM 🍄</span>' +
        '</div>'
      );

      // Slow, smooth loop animation along the polygon perimeter
      let progress = 0;
      const speed = 0.00035; // Completes full circuit in ~45 seconds smoothly
      let lastTimestamp = performance.now();

      function animateLoop(now) {
        const delta = (now - lastTimestamp) / 16.66; // Normalized to 60fps
        lastTimestamp = now;

        progress += speed * delta;
        if (progress >= 1) progress = 0;

        const pos = getPositionAt(progress);
        vanMarker.setLatLng([pos.lat, pos.lng]);

        // Flip vehicle direction when heading West vs East
        const vanSpan = document.getElementById('van-icon');
        if (vanSpan) {
          vanSpan.style.transform = pos.isHeadingWest ? 'scaleX(-1)' : 'scaleX(1)';
        }

        animFrameId = requestAnimationFrame(animateLoop);
      }

      animFrameId = requestAnimationFrame(animateLoop);
      isMapLoading = false;
    } catch (err) {
      console.error('Failed to initialize OpenStreetMap Leaflet map:', err);
      isMapLoading = false;
    }
  });

  onDestroy(() => {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
    }
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  const whatsappOrderUrl = `https://wa.me/917019760360?text=${encodeURIComponent(
    'Hi Only Superfoods! I am located in East Bengaluru and would like to order fresh harvest produce for tomorrow morning! 🍄🌱'
  )}`;
</script>

<style>
  /* Native hardware-accelerated animated marching hyphen border */
  :global(.running-delivery-border) {
    stroke-dasharray: 10, 8 !important;
    animation: dashLoop 1.2s linear infinite;
  }

  @keyframes dashLoop {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: -36;
    }
  }

  /* Completely hide Leaflet attribution watermark */
  :global(.leaflet-control-attribution) {
    display: none !important;
  }
</style>

<section id="delivery" data-section="delivery" class="w-full scroll-mt-20 bg-white px-4 pt-6 pb-8">
  <div class="mx-auto max-w-[440px]">
    
    <!-- ═══ 1. Section Header: Clean 2-Column Layout (Zero Overlap) ═══ -->
    <div class="mb-4 flex items-start justify-between gap-2">
      <!-- Left Column: Title & Subtitle -->
      <div class="flex-1 pr-1">
        <span class="block text-[11px] font-bold uppercase tracking-widest text-[#2B5A16]">
          OUR DELIVERY NETWORK
        </span>
        <h2
          class="mt-0.5 text-[1.75rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Where We Deliver
        </h2>
        <p class="mt-1 text-xs text-[#4A5A52] leading-relaxed">
          Fresh, local goodness across Whitefield and nearby East Bengaluru.
        </p>
      </div>

      <!-- Right Column: Mushroom Photo with Script Note Below (Clean & Separated) -->
      <div class="flex flex-col items-center shrink-0 w-24">
        <!-- Mushroom Visual -->
        <div class="h-16 w-22 overflow-hidden rounded-2xl shadow-2xs border border-[#E4E4DC]/80 bg-[#F7F7F2]">
          <img
            src="/images/prod-grey-oyster.jpg"
            alt="Freshly harvested grey oyster mushrooms"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        
        <!-- Script Note & Arrow (Underneath image, non-overlapping) -->
        <div class="mt-1 text-center pointer-events-none">
          <p
            class="text-[11px] font-bold leading-tight text-[#2B5A16]"
            style="font-family: 'Caveat', cursive, serif;"
          >
            Fresh From Kadugodi<br />to Your Home
          </p>
          <svg class="mx-auto mt-0.5 h-3.5 w-5 text-[#2B5A16]" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 1C10 6 12 11 15 12M15 12L11 9M15 12L17 8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- ═══ 2. Interactive Map Container Card ═══ -->
    <div class="overflow-hidden rounded-2xl border border-[#E4E4DC] bg-[#FAFBF7] shadow-xs">
      
      <!-- Map Viewport -->
      <div class="relative isolate z-0 h-[340px] sm:h-[360px] w-full">
        <!-- Animated Playful Delivery Zone Badge on Map -->
        <div class="absolute left-3 top-3 z-[400] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 shadow-sm border border-[#E4E4DC] backdrop-blur-xs">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8DC63F] opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2B5A16]"></span>
          </span>
          <span class="text-xs">🚚</span>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-[#0B1F2E]">
            ACTIVE ROUTE • WHITEFIELD &amp; EAST BLR
          </span>
        </div>

        <!-- Leaflet Map Container -->
        <div
          bind:this={mapContainer}
          class="h-full w-full bg-[#E5E9DF]"
          role="region"
          aria-label="Interactive East Bengaluru Delivery Zone Map"
        >
          {#if isMapLoading}
            <div class="flex h-full w-full items-center justify-center text-xs text-[#4A5A52]">
              <span>Loading OpenStreetMap Bengaluru...</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Map Legend Row -->
      <div class="flex items-center justify-around border-t border-[#E4E4DC] px-4 py-2.5 bg-white text-[10.5px] text-[#4A5A52]">
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-3.5 rounded-xs bg-[#74C043] border border-[#2B5A16]"></span>
          <span class="font-bold text-[#0B1F2E]">Core Express Zone (0 km)</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-2.5 w-3.5 rounded-xs border border-dashed border-[#84CC16] bg-[#BEF264]/40"></span>
          <span class="font-bold text-[#0B1F2E]">2 km Extended Buffer</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span>🌱 Kadugodi Farm Hub</span>
        </div>
      </div>
    </div>

    <!-- ═══ 3. Single Unified Bucket: 60+ Covered Villages in 3-Lane Format ═══ -->
    <div class="mt-4 rounded-2xl border border-[#E1EAD2] bg-gradient-to-b from-[#F9FAF5] to-[#F3F7EC] p-4 shadow-2xs">
      
      <!-- Card Header: Title & Context -->
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E2F0D0] text-[#2B5A16]">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3
              class="text-[1.2rem] font-bold leading-tight text-[#0B1F2E]"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              Every Village &amp; Layout We Cover
            </h3>
            <p class="text-[11px] text-[#4A5A52]">
              Daily morning drops across all 60 villages &amp; areas in our radar
            </p>
          </div>
        </div>
      </div>

      <!-- Quick Search Filter for Villages / Layouts -->
      <div class="relative mb-3.5 flex items-center">
        <svg class="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[#4A5A52]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <input
          type="text"
          bind:value={areaSearch}
          placeholder="Quick search village or layout (e.g. Avalahalli, Valepura...)"
          class="w-full rounded-xl border border-[#D5E2C4] bg-white py-2 pl-8 pr-3 text-[11px] font-medium text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]/30 transition-all placeholder:text-[#4A5A52]/60"
        />
        {#if areaSearch}
          <button
            onclick={() => (areaSearch = '')}
            class="absolute right-2.5 text-xs text-[#4A5A52] hover:text-[#0B1F2E]"
          >
            ✕
          </button>
        {/if}
      </div>

      <!-- Single Bucket: 3-Lane Format Layout -->
      <div class="grid grid-cols-3 gap-2 rounded-xl border border-[#DDE7CF] bg-white/95 p-3 shadow-2xs">
        
        <!-- Lane 1 -->
        <div class="flex flex-col gap-1.5">
          {#each lane1 as area}
            <div class="flex items-start gap-1 text-[10px] sm:text-[10.5px] leading-tight font-medium text-[#0B1F2E]">
              <span class="text-[#8DC63F] font-bold shrink-0">✓</span>
              <span class="truncate">{area}</span>
            </div>
          {/each}
        </div>

        <!-- Lane 2 -->
        <div class="flex flex-col gap-1.5 border-x border-[#EAEFE0] px-1.5">
          {#each lane2 as area}
            <div class="flex items-start gap-1 text-[10px] sm:text-[10.5px] leading-tight font-medium text-[#0B1F2E]">
              <span class="text-[#8DC63F] font-bold shrink-0">✓</span>
              <span class="truncate">{area}</span>
            </div>
          {/each}
        </div>

        <!-- Lane 3 -->
        <div class="flex flex-col gap-1.5 pl-0.5">
          {#each lane3 as area}
            <div class="flex items-start gap-1 text-[10px] sm:text-[10.5px] leading-tight font-medium text-[#0B1F2E]">
              <span class="text-[#8DC63F] font-bold shrink-0">✓</span>
              <span class="truncate">{area}</span>
            </div>
          {/each}
        </div>

      </div>

      <!-- Expand / Show All Button (when not searching) -->
      {#if !areaSearch.trim()}
        <div class="mt-2 text-center">
          <button
            onclick={() => (isExpanded = !isExpanded)}
            class="inline-flex items-center gap-1 text-[11px] font-bold text-[#2B5A16] hover:underline press py-1"
          >
            <span>{isExpanded ? 'Show less ▴' : `View all ${allCoveredAreas.length} covered villages & layouts (${allCoveredAreas.length - 24} more) ▾`}</span>
          </button>
        </div>
      {/if}

      <!-- 1-Click WhatsApp Order CTA -->
      <div class="mt-3.5 pt-1">
        <a
          href={whatsappOrderUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8DC63F] py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#7db534] active:scale-98 press"
        >
          <span>Order for Your Area on WhatsApp</span>
          <span class="text-sm">💬</span>
        </a>
      </div>
    </div>

    <!-- ═══ 4. Expansion Announcement Banner ═══ -->
    <div class="mt-3.5 flex items-center justify-between overflow-hidden rounded-2xl border border-[#FBE0C7] bg-[#FEF3E8] p-3 shadow-2xs">
      <div class="flex items-center gap-3">
        <!-- Orange Delivery Van Icon Circle -->
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FCE3CC] text-[#FF5E00]">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25zM15 8.25v5.25h4.875c.621 0 1.125-.504 1.125-1.125v-1.875a2.25 2.25 0 00-.659-1.591l-1.875-1.875A2.25 2.25 0 0016.875 8.25H15zM1.5 15v1.875C1.5 17.914 2.34 18.75 3.375 18.75h1.125a3 3 0 016 0h3a3 3 0 016 0h1.125c1.036 0 1.875-.84 1.875-1.875V15H1.5z"/>
            <circle cx="7.5" cy="18.75" r="1.5" fill="#FEF3E8"/>
            <circle cx="16.5" cy="18.75" r="1.5" fill="#FEF3E8"/>
          </svg>
        </div>

        <div>
          <h4 class="text-xs font-bold text-[#0B1F2E]">
            Expanding across East Bengaluru
          </h4>
          <p class="text-[11px] text-[#6B5542]">
            Don't see your layout? Message us to request a route!
          </p>
        </div>
      </div>

      <!-- Dotted curve with Leaf Accent -->
      <div class="relative shrink-0 pl-1 pr-1">
        <svg class="h-6 w-12 text-[#FF5E00]/40" viewBox="0 0 48 24" fill="none">
          <path d="M2 20C14 6 34 6 46 20" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>
        </svg>
        <div class="absolute -right-0.5 top-0 text-sm">
          🍃
        </div>
      </div>
    </div>

  </div>
</section>
