<!--
  DesktopFarmStory.svelte — Interactive 3-stage Farm-to-Door storytelling band (1024px+ only)
  Uses bespoke widescreen indoor farm & harvest photography with smooth transitions.
  Svelte 5 runes mode.
-->
<script>
  let activeStage = $state(0);

  const stages = [
    {
      num: '01',
      eyebrow: 'Climate-Controlled Growing',
      title: 'Kadugodi Indoor Fruiting Rooms',
      copy: 'Our grey and pink oyster clusters grow inside hyper-hygienic, humidity-controlled rooms in Kadugodi. Zero chemical sprays or synthetic fertilizers—just organic hardwood sawdust, filtered air, and twice-daily misting.',
      image: '/images/desktop-story-fruiting-room.jpg',
      alt: 'Indoor mushroom fruiting shelves in Kadugodi',
      metrics: [
        { label: 'Humidity', value: '90–94% RH' },
        { label: 'Pesticides', value: 'Zero (0%)' },
        { label: 'Substrate', value: 'Organic Hardwood' },
      ],
    },
    {
      num: '02',
      eyebrow: 'Dawn Harvest • 5:30 AM',
      title: 'Harvested Only What You Order',
      copy: 'Every morning at 5:30 AM, clusters are hand-picked at peak moisture curl and living microgreens are clipped minutes before packing into breathable kraft paper punnets. Nothing sits in cold storage for days.',
      image: '/images/desktop-story-harvest-dawn.jpg',
      alt: 'Dawn harvesting of fresh microgreens and oyster mushrooms',
      metrics: [
        { label: 'Pick Time', value: '5:30 AM Dawn' },
        { label: 'Cold Storage', value: '0 Hours' },
        { label: 'Packaging', value: 'Breathable Kraft' },
      ],
    },
    {
      num: '03',
      eyebrow: 'Hyper-Local Dispatch',
      title: 'Farm to Kitchen in Hours',
      copy: 'Cut out distributors and dark-store warehouses completely. Our Kadugodi dispatch van rolls out at 7:00 AM directly across Whitefield, Hoodi, Varthur, Brookefield, and East Bengaluru before 10:00 AM.',
      image: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/From%20Farm%20to%20Kitchen%20in%20Hours.webp',
      alt: 'Fresh produce packed for East Bengaluru morning delivery',
      metrics: [
        { label: 'Delivery Window', value: '7:00 – 10:00 AM' },
        { label: 'Order Cutoff', value: '11:59 PM Night' },
        { label: 'Freshness Guarantee', value: '100% Replace/Refund' },
      ],
    },
  ];
</script>

<section id="desktop-story" class="w-full scroll-mt-20 bg-[#143922] py-20 text-white border-y border-[#1F5132]">
  <div class="mx-auto max-w-[1280px] px-8">
    <!-- Section Intro -->
    <div class="mb-12 flex items-end justify-between gap-8">
      <div class="max-w-2xl space-y-2">
        <span class="text-xs font-extrabold uppercase tracking-[0.16em] text-[#A8D632]">
          Farm To Doorstep
        </span>
        <h2
          class="text-3xl xl:text-4xl font-bold leading-tight text-white"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          How Fresh Food Is Actually Supposed To Work
        </h2>
      </div>
      <p class="max-w-md text-sm text-white/75 leading-relaxed">
        True superfoods lose nearly half their delicate micronutrients 48 hours after harvest. So we built our farm right beside East Bengaluru.
      </p>
    </div>

    <!-- 2-Column Split Interactive Stage -->
    <div class="grid grid-cols-12 items-stretch gap-10">
      <!-- Left: Interactive Stage Selector Cards -->
      <div class="col-span-5 flex flex-col justify-between gap-4">
        {#each stages as s, idx}
          <button
            type="button"
            onclick={() => (activeStage = idx)}
            class="w-full rounded-2xl border p-6 text-left transition-all duration-200 press {activeStage === idx
              ? 'border-[#A8D632] bg-white/10 shadow-lg'
              : 'border-white/15 bg-white/[0.03] hover:bg-white/[0.07]'}"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="text-[11px] font-extrabold uppercase tracking-widest {activeStage === idx ? 'text-[#A8D632]' : 'text-white/55'}">
                Stage {s.num} · {s.eyebrow}
              </span>
              <span class="text-xs font-bold {activeStage === idx ? 'text-[#A8D632]' : 'text-white/40'}">
                {activeStage === idx ? '● Active' : 'View →'}
              </span>
            </div>

            <h3
              class="mt-2 text-xl font-bold text-white"
              style="font-family: 'Playfair Display', Georgia, serif;"
            >
              {s.title}
            </h3>

            <p class="mt-2 text-xs leading-relaxed {activeStage === idx ? 'text-white/90' : 'text-white/60 line-clamp-2'}">
              {s.copy}
            </p>
          </button>
        {/each}
      </div>

      <!-- Right: Widescreen Editorial Visual Display -->
      <div class="col-span-7 flex flex-col justify-between rounded-3xl border border-white/15 bg-[#0D2717] p-5 shadow-2xl">
        <div class="relative overflow-hidden rounded-2xl bg-[#0B1F2E]">
          <img
            src={stages[activeStage].image}
            alt={stages[activeStage].alt}
            class="aspect-[16/10] w-full object-cover transition-all duration-500"
            loading="lazy"
          />
          <div class="absolute bottom-4 left-4 rounded-full bg-black/70 backdrop-blur-sm px-3.5 py-1.5 text-xs font-bold text-[#D8F3A0] border border-white/15">
            {stages[activeStage].eyebrow}
          </div>
        </div>

        <!-- Stage Telemetry Metrics Bar -->
        <div class="mt-5 grid grid-cols-3 gap-4 rounded-2xl bg-white/[0.06] border border-white/10 p-4">
          {#each stages[activeStage].metrics as m}
            <div class="px-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-white/55">
                {m.label}
              </div>
              <div class="mt-0.5 text-sm font-extrabold text-[#A8D632]">
                {m.value}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

