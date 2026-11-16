<!--
  CheckoutMiniMap.svelte — Compact Checkout Delivery Radar & Customer Location Pin
  Features:
  - Interactive Leaflet mini-map embedded into checkout Step 2
  - Core Whitefield zone polygon (rich green)
  - 2 km Extended Zone polygon buffer (dashed lime)
  - Draggable Customer Pin (📍) with real-time zone detection
  - Reverse geocoding on pin drag/drop
  - 1-click "Locate Me" GPS trigger
  - Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from 'svelte';
  import {
    CORE_POLYGON_COORDS,
    EXTENDED_BUFFER_POLYGON,
    FARM_HUB_COORDS,
    evaluateDeliveryZone,
  } from '../lib/geo.js';

  let {
    lat = 12.9698,
    lng = 77.7499,
    onPositionChanged = () => {},
  } = $props();

  let mapContainer = $state(null);
  let mapInstance = null;
  let customerMarker = null;
  let isLocating = $state(false);

  let currentLat = $state(lat);
  let currentLng = $state(lng);

  // Reactive zone evaluation
  let zoneInfo = $derived(evaluateDeliveryZone(currentLat, currentLng));

  onMount(async () => {
    if (typeof window === 'undefined' || !mapContainer) return;

    try {
      const L = (await import('leaflet')).default;

      mapInstance = L.map(mapContainer, {
        center: [currentLat, currentLng],
        zoom: 12,
        minZoom: 10,
        maxZoom: 16,
        scrollWheelZoom: false,
        attributionControl: false,
        zoomControl: false,
      });

      // Subtle base map tiles
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(mapInstance);

      // 1. 2 km Extended Zone Outer Buffer Layer
      L.polygon(EXTENDED_BUFFER_POLYGON, {
        stroke: true,
        color: '#84CC16',
        dashArray: '6, 6',
        weight: 1.8,
        fillColor: '#BEF264',
        fillOpacity: 0.12,
      }).addTo(mapInstance);

      // 2. Core Prime Harvest Zone
      const corePolygon = L.polygon(CORE_POLYGON_COORDS, {
        stroke: true,
        color: '#2B5A16',
        weight: 2.2,
        fillColor: '#74C043',
        fillOpacity: 0.28,
      }).addTo(mapInstance);

      // 3. Kadugodi Farm Hub Pin
      const farmIcon = L.divIcon({
        className: 'farm-hub-marker',
        html: `
          <div style="background:#2B5A16; color:#ffffff; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #ffffff; box-shadow:0 2px 5px rgba(0,0,0,0.25); font-size:13px;">
            🌱
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker(FARM_HUB_COORDS, { icon: farmIcon })
        .addTo(mapInstance)
        .bindTooltip('🌱 Kadugodi Farm Hub', { direction: 'top', offset: [0, -10] });

      // 4. Draggable Customer Delivery Pin
      const customerIcon = L.divIcon({
        className: 'customer-delivery-pin',
        html: `
          <div class="relative flex flex-col items-center cursor-grab active:cursor-grabbing">
            <div style="background:#0B1F2E; border:2.5px solid #A8D632; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 10px rgba(0,0,0,0.35); font-size:16px;">
              📍
            </div>
            <div style="position:absolute; bottom:-16px; background:#0B1F2E; color:#ffffff; font-size:9px; font-weight:800; padding:1px 5px; border-radius:6px; white-space:nowrap; border:1px solid #A8D632; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
              Your Drop
            </div>
          </div>
        `,
        iconSize: [34, 44],
        iconAnchor: [17, 22],
      });

      customerMarker = L.marker([currentLat, currentLng], {
        icon: customerIcon,
        draggable: true,
      }).addTo(mapInstance);

      // On Pin Drag End
      customerMarker.on('dragend', async (e) => {
        const pos = e.target.getLatLng();
        handleNewPosition(pos.lat, pos.lng);
      });

      // On Map Click
      mapInstance.on('click', (e) => {
        handleNewPosition(e.latlng.lat, e.latlng.lng);
      });

      // Auto frame so both core zone and customer pin are visible
      mapInstance.setView([currentLat, currentLng], 12);
    } catch (e) {
      console.warn('Leaflet mini-map initialization error', e);
    }
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  async function handleNewPosition(newLat, newLng) {
    currentLat = newLat;
    currentLng = newLng;
    if (customerMarker) {
      customerMarker.setLatLng([newLat, newLng]);
    }
    if (mapInstance) {
      mapInstance.panTo([newLat, newLng], { animate: true });
    }

    // Evaluate zone
    const evaluated = evaluateDeliveryZone(newLat, newLng);

    // Optional reverse geocoding to suggest clean address
    let formattedAddress = '';
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=17`,
        { headers: { 'User-Agent': 'OnlySuperfoodsCheckout/1.0' } }
      );
      if (res.ok) {
        const data = await res.json();
        const a = data.address || {};
        const road = a.road || a.street || '';
        const suburb = a.suburb || a.neighbourhood || a.residential || '';
        const city = a.city || a.town || a.village || 'Bangalore';
        formattedAddress = [road, suburb, city].filter(Boolean).join(', ');
      }
    } catch (e) {}

    onPositionChanged({
      lat: newLat,
      lng: newLng,
      zone: evaluated,
      suggestedAddress: formattedAddress,
    });
  }

  function handleLocateMe() {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    isLocating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        isLocating = false;
        handleNewPosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        isLocating = false;
        console.warn('Geolocation error', err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
</script>

<div class="relative overflow-hidden rounded-2xl border border-[#E4E4DC] bg-white shadow-2xs">
  <!-- Top Real-Time Zone Status Pill -->
  <div class="flex items-center justify-between border-b border-[#E4E4DC] px-3.5 py-2.5 bg-[#FAF7F0]">
    <div class="flex items-center gap-2">
      <span
        class="h-2.5 w-2.5 rounded-full animate-pulse"
        style="background-color: {zoneInfo.pillBg};"
      ></span>
      <div>
        <p class="text-xs font-bold text-[#0B1F2E]">
          {zoneInfo.label}
        </p>
        <p class="text-[10px] text-[#4A5A52]">
          {zoneInfo.description}
        </p>
      </div>
    </div>

    <!-- Quick Status Badge -->
    <span
      class="shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold border {zoneInfo.tagClass}"
    >
      {zoneInfo.badge}
    </span>
  </div>

  <!-- Leaflet Map Container -->
  <div class="relative isolate z-0 h-[190px] w-full bg-[#E5E3DF]">
    <div bind:this={mapContainer} class="h-full w-full"></div>

    <!-- "Locate Me" Button Overlay -->
    <button
      type="button"
      onclick={handleLocateMe}
      class="absolute right-2.5 bottom-2.5 z-[1000] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#2B5A16] shadow-md border border-[#E4E4DC] backdrop-blur-xs hover:bg-[#F7F7F2] active:scale-95 transition-all"
    >
      {#if isLocating}
        <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#2B5A16] border-t-transparent"></span>
        Finding...
      {:else}
        <span>📍</span>
        Use GPS
      {/if}
    </button>

    <!-- Interactive Hint Pill on Bottom-Left -->
    <div class="absolute left-2.5 bottom-2.5 z-[1000] pointer-events-none rounded-md bg-[#0B1F2E]/80 px-2 py-1 text-[9.5px] font-medium text-white shadow-xs backdrop-blur-xs">
      Drag 📍 pin to adjust doorstep
    </div>
  </div>

  <!-- Legend Row -->
  <div class="flex items-center justify-around border-t border-[#E4E4DC] px-3 py-1.5 bg-white text-[10px] text-[#4A5A52]">
    <div class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-3 rounded-xs bg-[#74C043] border border-[#2B5A16]"></span>
      <span>Core Harvest Zone</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="inline-block h-2 w-3 rounded-xs border border-dashed border-[#84CC16] bg-[#BEF264]/40"></span>
      <span>2 km Extended Zone</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span>🌱 Kadugodi Farm Hub</span>
    </div>
  </div>
</div>

