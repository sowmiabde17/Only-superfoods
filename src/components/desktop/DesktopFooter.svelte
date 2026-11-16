<!--
  DesktopFooter.svelte — Multi-column editorial desktop footer (1024px+ only)
  Svelte 5 runes mode.
-->
<script>
  import { site } from '../../data/site.js';
</script>

<footer class="w-full bg-[#143922] text-[#FAF7F0] pt-16 pb-12 border-t border-[#1E4D30]">
  <div class="mx-auto max-w-[1280px] px-8">
    <div class="grid grid-cols-12 gap-10 pb-12 border-b border-white/15">
      <!-- Column 1: Brand & Farm Identity -->
      <div class="col-span-4 space-y-4 pr-6">
        <div>
          <h3
            class="text-2xl font-bold text-white tracking-tight"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Only Superfoods
          </h3>
          <p class="mt-1 text-sm text-[#D8F3A0] font-medium">{site.tagline}</p>
        </div>

        <p class="text-xs leading-relaxed text-white/75">
          Grown in humidity-controlled indoor farms and pasture plots in Kadugodi, Bangalore. Harvested at 5:30 AM dawn and delivered fresh to your doorstep before 10:00 AM.
        </p>

        <div class="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-1">
          <div class="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#A8D632]">
            <span>🌱</span>
            <span>FSSAI Registered Farm Facility</span>
          </div>
          <p class="text-[11px] text-white/75 leading-relaxed">
            {site.address.full}<br />
            100% Chemical &amp; Pesticide-Free Produce
          </p>
        </div>

        <div class="flex items-center gap-3 pt-1">
          <a
            href={site.whatsapp.link}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white hover:bg-[#20ba59] transition-colors press"
          >
            <span>WhatsApp Order</span>
          </a>
          <a
            href={site.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition-colors"
          >
            <span>Instagram</span>
          </a>
        </div>
      </div>

      <!-- Column 2: Harvest Shop -->
      <div class="col-span-3 space-y-3">
        <h4 class="text-xs font-extrabold uppercase tracking-widest text-[#A8D632]">
          Fresh Harvest
        </h4>
        <ul class="space-y-2.5 text-sm text-white/80">
          <li><a href="/#desktop-catalog" class="hover:text-white transition-colors">All Morning Produce</a></li>
          <li><a href="/products/grey-oyster-mushrooms" class="hover:text-white transition-colors">Grey Oyster Mushrooms</a></li>
          <li><a href="/products/pink-oyster-mushrooms" class="hover:text-white transition-colors">Pink &amp; Mixed Oysters</a></li>
          <li><a href="/products/sunflower-microgreens" class="hover:text-white transition-colors">Living Sunflower Microgreens</a></li>
          <li><a href="/products/kombucha-original" class="hover:text-white transition-colors">21-Day Raw Kombucha</a></li>
          <li><a href="/products/desi-eggs" class="hover:text-white transition-colors">Free-Range Desi Eggs</a></li>
          <li><a href="/subscribe" class="text-[#D8F3A0] font-semibold hover:text-white transition-colors">Weekly Routine Box →</a></li>
        </ul>
      </div>

      <!-- Column 3: Explore -->
      <div class="col-span-2 space-y-3">
        <h4 class="text-xs font-extrabold uppercase tracking-widest text-[#A8D632]">
          Explore
        </h4>
        <ul class="space-y-2.5 text-sm text-white/80">
          <li><a href="/#desktop-story" class="hover:text-white transition-colors">Kadugodi Farm Story</a></li>
          <li><a href="/#desktop-delivery" class="hover:text-white transition-colors">Delivery Zone Map</a></li>
          <li><a href="/recipes" class="hover:text-white transition-colors">Farm Kitchen Recipes</a></li>
          <li><a href="/cart" class="hover:text-white transition-colors">Your Fresh Bag</a></li>
        </ul>
      </div>

      <!-- Column 4: Policies & Payments -->
      <div class="col-span-3 space-y-3">
        <h4 class="text-xs font-extrabold uppercase tracking-widest text-[#A8D632]">
          Policies &amp; Support
        </h4>
        <ul class="space-y-2.5 text-sm text-white/80">
          <li><a href="/shipping" class="hover:text-white transition-colors">Shipping &amp; Dawn Delivery</a></li>
          <li><a href="/refunds" class="hover:text-white transition-colors">Cancellation &amp; Refunds</a></li>
          <li><a href="/terms" class="hover:text-white transition-colors">Terms &amp; Conditions</a></li>
          <li><a href="/privacy" class="hover:text-white transition-colors">Privacy Policy</a></li>
        </ul>

        <div class="mt-4 rounded-xl border border-white/15 bg-white/5 p-3.5 text-[11px] text-white/80 space-y-1">
          <div class="font-bold text-white flex items-center gap-1.5">
            <span>🔒</span>
            <span>100% Secure Checkout</span>
          </div>
          <p class="text-white/65">UPI, GPay, PhonePe, Cards via Razorpay, or Pay on Delivery.</p>
        </div>
      </div>
    </div>

    <!-- Bottom Legal Strip -->
    <div class="pt-6 flex items-center justify-between text-xs text-white/60">
      <p>© {new Date().getFullYear()} Only Superfoods • Kadugodi, Whitefield, Bangalore 560067.</p>
      <p>Morning Harvest Drop: 7:00 AM – 10:00 AM Daily</p>
    </div>
  </div>
</footer>

