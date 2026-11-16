<!--
  ProductsHeroBanner.svelte — Panoramic "Our Products" Value-Prop Banner
  Matches Design Reference (Image 2):
  - "Our Products" heading in serif font
  - "Farm fresh goodness for a healthier you." in green handwriting script + orange swoosh
  - Subtle doodle sprout illustrations
  - High-resolution editorial harvest photoshoot spread
  - 4 value-prop items: Locally Grown, Chemical Free, Fresh to Your Door, Better Living
  Svelte 5 runes mode.
-->
<section class="w-full bg-white px-4 pt-5 pb-3">
  <div class="mx-auto max-w-[440px]">
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FAF7F1] via-[#FAF6EE] to-[#F3EEE2] p-4 sm:p-5 border border-[#E9E3D3] shadow-2xs">
      
      <!-- Upper Content Row -->
      <div class="relative z-10 flex items-start justify-between min-h-[140px]">
        <!-- Title & Subtitle with Script & Doodles -->
        <div class="relative max-w-[210px] sm:max-w-[230px] pt-1">
          
          <!-- Subtle Hand-drawn Leaf/Sprout Doodle (from Image 2) -->
          <svg class="absolute -top-3 left-12 h-6 w-8 text-[#2B5A16]/60 pointer-events-none" viewBox="0 0 40 30" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 25C14 15 22 8 30 10C32 18 24 23 15 25Z" stroke-linecap="round"/>
            <path d="M18 20C19 12 14 6 5 8C3 15 9 20 16 21" stroke-linecap="round"/>
          </svg>

          <h2
            class="text-[2rem] sm:text-[2.2rem] font-black leading-none tracking-tight text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Our<br />Products
          </h2>

          <div class="relative mt-2 inline-block">
            <p
              class="text-[1.25rem] leading-tight text-[#2B5A16] font-semibold"
              style="font-family: 'Caveat', cursive, serif;"
            >
              Farm fresh goodness<br />for a healthier you.
            </p>
            
            <!-- Orange Curved Underline Swoosh (Matches Image 2) -->
            <svg class="absolute -bottom-2 left-0 w-36 h-3 text-[#FF6A00] pointer-events-none" viewBox="0 0 140 12" fill="none">
              <path d="M2 9C40 2 100 1 138 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>

        <!-- Harvest Spread Editorial Photo Asset on Right -->
        <div class="absolute -right-2 -top-2 -bottom-2 w-[54%] overflow-hidden pointer-events-none">
          <img
            src="https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/hero%20.webp"
            alt="Farm fresh superfoods harvest spread"
            class="h-full w-full object-cover object-center"
            loading="eager"
          />
          <div class="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#FAF6EE] to-transparent"></div>
        </div>
      </div>

      <!-- Lower Value Props Pill Bar (Matches Image 2 exactly) -->
      <div class="relative z-10 mt-4 grid grid-cols-4 gap-1.5 rounded-xl bg-white/95 p-2.5 backdrop-blur-xs border border-[#E4E4DC]/80 shadow-2xs">
        <!-- 1. Locally Grown -->
        <div class="flex flex-col items-center text-center gap-1">
          <svg class="h-4 w-4 text-[#2B5A16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
          <span class="text-[9px] font-bold leading-tight text-[#0B1F2E]">Locally<br />Grown</span>
        </div>

        <!-- 2. Chemical Free -->
        <div class="flex flex-col items-center text-center gap-1">
          <svg class="h-4 w-4 text-[#2B5A16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 2v7.31L4.89 20A2 2 0 0 0 6.67 23h10.66a2 2 0 0 0 1.78-3L14 9.31V2"/>
            <path d="M8.5 2h7M7 16h10"/>
          </svg>
          <span class="text-[9px] font-bold leading-tight text-[#0B1F2E]">Chemical<br />Free</span>
        </div>

        <!-- 3. Fresh to Your Door -->
        <div class="flex flex-col items-center text-center gap-1">
          <svg class="h-4 w-4 text-[#2B5A16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
            <path d="M15 18H9"/>
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z"/>
            <circle cx="17" cy="18" r="2"/>
            <circle cx="7" cy="18" r="2"/>
          </svg>
          <span class="text-[9px] font-bold leading-tight text-[#0B1F2E]">Fresh to<br />Your Door</span>
        </div>

        <!-- 4. Better Living -->
        <div class="flex flex-col items-center text-center gap-1">
          <svg class="h-4 w-4 text-[#2B5A16]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
          <span class="text-[9px] font-bold leading-tight text-[#0B1F2E]">Better<br />Living</span>
        </div>
      </div>
    </div>
  </div>
</section>

