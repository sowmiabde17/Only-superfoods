<!--
  RecipeDetail.svelte — Single Recipe Detail Page
  Matches Screen 2 in Design Reference:
  - Back arrow header + Only Superfoods logo + search + cart badge (2)
  - Full-width hero with play button, handwritten title note "Garlic Butter Oyster Mushrooms ⤵", and "5 min prep" badge
  - Recipe title + wishlist heart toggle
  - Metadata: Prep, Cook, Serves, Easy
  - Description paragraph
  - NUTRIENT HIGHLIGHTS pill tags (High protein, Low calorie, Rich in B vitamins, Good source of iron)
  - 3-tab segmented control: [ Ingredients ] [ Steps ] [ Notes ]
  - Scaled ingredients list with 2 servings dropdown
  - Fresh produce purchase bar: Price (₹100), product name, [ Add to Cart ], [ Buy Now ]
  - "More Mushroom Recipes" recommendations (Creamy Mushroom Pasta, Mushroom Fried Rice, Spicy Mushroom Stir-fry)
  Svelte 5 runes mode.
-->
<script>
  import { onMount, onDestroy } from "svelte";
  import { addToCart, openCartDrawer } from "../lib/cart.js";
  import { getEffectiveStatus, isProductAvailable } from "../lib/inventory.js";
  import { getRecipeBySlug } from "../lib/recipesStore.js";
  import { getProductById } from "../lib/productsStore.js";

  let { recipe, product, relatedRecipes = [] } = $props();

  let dynamicRecipe = $state(null);
  let r = $derived(dynamicRecipe || recipe);

  let prodId = $derived(product?.id || r?.productId || "grey-oyster");
  let liveProduct = $state(null);
  let liveGarnishProduct = $state(null);
  let activeProduct = $derived(liveProduct || product);
  let stockStatus = $state("IN_STOCK");

  function syncLiveProduce() {
    liveProduct = getProductById(prodId) || product || null;
    liveGarnishProduct = getProductById("sunflower-microgreens") || null;
  }

  function checkStock() {
    stockStatus = getEffectiveStatus(prodId);
  }

  // Active Tab: 'ingredients' | 'steps' | 'notes'
  let activeTab = $state("ingredients");
  let selectedServings = $state(2);
  let isSaved = $state(false);
  let isVideoPlaying = $state(false);
  let addedFeedback = $state(false);
  let bundleAddedFeedback = $state(false);

  let garnishOriginalPrice = $derived(
    Number(liveGarnishProduct?.packSizes?.[0]?.price ?? liveGarnishProduct?.price ?? 80)
  );
  let garnishBundlePrice = $derived(Math.max(10, garnishOriginalPrice - 20));
  let bundleSavingsAmount = $derived(Math.max(0, garnishOriginalPrice - garnishBundlePrice));

  // Pack selection synced live to activeProduct
  let selectedPack = $derived.by(() => {
    const pack0 = activeProduct?.packSizes?.[0];
    return {
      size: pack0?.size || activeProduct?.unit || r?.productPackSize || "250 g",
      price: Number(pack0?.price ?? activeProduct?.price ?? r?.productPackPrice ?? 100),
    };
  });

  $effect(() => {
    if (recipe?.servings) {
      selectedServings = recipe.servings;
    }
  });

  // Weekly box expansion state
  let showWeeklyBox = $state(false);
  let frequency = $state("1x");
  let deliveryDays = $state(["Monday"]);

  const weekDays = [
    { label: "Mon", full: "Monday" },
    { label: "Tue", full: "Tuesday" },
    { label: "Wed", full: "Wednesday" },
    { label: "Thu", full: "Thursday" },
    { label: "Fri", full: "Friday" },
    { label: "Sat", full: "Saturday" },
  ];
  const weekOrder = weekDays.map((d) => d.full);
  const pairDay = {
    Monday: "Thursday",
    Tuesday: "Friday",
    Wednesday: "Saturday",
    Thursday: "Monday",
    Friday: "Tuesday",
    Saturday: "Wednesday",
  };

  function setRecipeFrequency(next) {
    frequency = next;
    if (next === "2x") {
      if (deliveryDays.length < 2) {
        const first = deliveryDays[0] || "Monday";
        deliveryDays = [first, pairDay[first] || "Thursday"];
      }
    } else {
      deliveryDays = [deliveryDays[deliveryDays.length - 1] || "Monday"];
    }
  }

  function toggleRecipeDeliveryDay(dayFull) {
    if (frequency === "1x") {
      deliveryDays = [dayFull];
      return;
    }
    if (deliveryDays.includes(dayFull)) {
      if (deliveryDays.length > 1) {
        deliveryDays = deliveryDays.filter((d) => d !== dayFull);
      }
      return;
    }
    deliveryDays = deliveryDays.length < 2 ? [...deliveryDays, dayFull] : [deliveryDays[1], dayFull];
  }

  let formattedDeliveryDays = $derived(
    [...deliveryDays].sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b)).join(" & "),
  );

  let weeklyPrice = $derived(
    frequency === "2x" ? selectedPack.price * 2 : selectedPack.price,
  );

  function handleAddBundleToCart() {
    const mainProd = activeProduct || {
      id: r?.productId || "grey-oyster",
      name: r?.product || "Grey Oyster Mushrooms",
      image: r?.thumbnail,
    };
    const garnishProd = {
      id: "sunflower-microgreens",
      name: "Sunflower Microgreens (Garnish Pack)",
      image: liveGarnishProduct?.image || "/images/prod-microgreens-mix.jpg",
      price: garnishBundlePrice,
      unit: liveGarnishProduct?.unit || "50 g",
    };

    if (stockStatus === "OUT_OF_STOCK" || !isProductAvailable(mainProd.id, 1)) {
      alert(
        `Sorry! ${mainProd.name} is currently sold out for today's harvest drop.`,
      );
      return;
    }

    addToCart(mainProd, selectedPack, 1);
    addToCart(
      { ...garnishProd, isBundleDiscount: true },
      { size: garnishProd.unit, price: garnishBundlePrice, isBundleDiscount: true },
      1
    );

    bundleAddedFeedback = true;
    setTimeout(() => {
      bundleAddedFeedback = false;
      openCartDrawer();
    }, 600);
  }

  onMount(() => {
    syncLiveProduce();
    checkStock();
    const loaded = getRecipeBySlug(recipe?.slug);
    if (loaded) {
      dynamicRecipe = loaded;
    }
    window.addEventListener("osf:inventory-updated", checkStock);
    window.addEventListener("osf:products-updated", syncLiveProduce);
    try {
      const saved = localStorage.getItem("osf_favorite_recipes");
      if (saved) {
        const list = JSON.parse(saved);
        isSaved = list.includes(r?.slug || recipe?.slug);
      }
    } catch (e) {
      console.error(e);
    }
  });

  onDestroy(() => {
    if (typeof window !== "undefined") {
      window.removeEventListener("osf:inventory-updated", checkStock);
      window.removeEventListener("osf:products-updated", syncLiveProduce);
    }
  });

  function toggleFavorite() {
    isSaved = !isSaved;
    try {
      const saved = localStorage.getItem("osf_favorite_recipes");
      let list = saved ? JSON.parse(saved) : [];
      const currentSlug = r?.slug || recipe?.slug;
      if (isSaved) {
        if (!list.includes(currentSlug)) list.push(currentSlug);
      } else {
        list = list.filter((s) => s !== currentSlug);
      }
      localStorage.setItem("osf_favorite_recipes", JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  }

  function handleAddToCart() {
    const prodToCart = activeProduct || {
      id: r?.productId || "grey-oyster",
      name: r?.product || "Grey Oyster Mushrooms",
      image: r?.thumbnail,
    };
    if (
      stockStatus === "OUT_OF_STOCK" ||
      !isProductAvailable(prodToCart.id, 1)
    ) {
      alert(`Sorry! ${prodToCart.name} is sold out for today.`);
      return;
    }
    addToCart(prodToCart, selectedPack, 1);
    addedFeedback = true;
    setTimeout(() => {
      addedFeedback = false;
    }, 2000);
  }

  function handleBuyNow() {
    const text = `Hi Only Superfoods team! 🍄\n\nI'm ordering fresh *${r?.product || "Grey Oyster Mushrooms"}* to cook *${r?.title}*:\n\n• Pack: ${selectedPack.size}\n• Price: ₹${selectedPack.price}\n\nPlease confirm availability and morning delivery slot!`;
    const url = `https://wa.me/917019760360?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  function handleSubscribeWhatsApp() {
    const freqLabel =
      frequency === "1x" ? "Every Week (1x)" : "Twice a Week (2x)";
    const text = `Hi Only Superfoods team! 🍄\n\nI'd like to add *${r?.product || "Grey Oyster Mushrooms"}* to my Weekly Routine from the recipe *${r?.title}*:\n\n📦 *Routine:* ${freqLabel}\n🗓 *Delivery Day(s):* Every ${formattedDeliveryDays}\n⚖️ *Quantity:* ${selectedPack.size}\n💰 *Estimated Total:* ₹${weeklyPrice}/week\n\nPlease set up my fresh weekly farm drop!`;
    const url = `https://wa.me/917019760360?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  // Helper to scale quantity
  function formatQty(baseQty) {
    if (baseQty == null) return "";
    const scaled = (baseQty * selectedServings) / (r?.servings || 2);
    if (scaled === 0.5) return "½";
    if (scaled === 0.25) return "¼";
    if (scaled === 0.75) return "¾";
    return Number.isInteger(scaled)
      ? scaled.toString()
      : scaled.toFixed(1).replace(/\.0$/, "");
  }
</script>

<div class="mx-auto max-w-[440px] bg-white text-[#0B1F2E] pb-12 font-sans">
  <!-- 1. Hero Video / Photo Header with Play Button & Handwritten Badge -->
  <div class="relative aspect-[16/10] w-full overflow-hidden bg-[#0B1F2E]">
    <img src={r.thumbnail} alt={r.title} class="h-full w-full object-cover" />

    <!-- Subtle vignette -->
    <div
      class="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-black/30 pointer-events-none"
    ></div>

    <!-- Handwritten Title in Top Right with Arrow -->
    <div
      class="absolute top-3 right-3 text-right pointer-events-none drop-shadow-md"
    >
      <div
        class="font-handwritten text-[16px] sm:text-[18px] leading-[1.1] text-white font-bold tracking-wide -rotate-3"
      >
        {r.title}
      </div>
      <svg
        class="w-5 h-5 text-white inline-block -rotate-12 mt-0.5 ml-2 drop-shadow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 5v14M19 12l-7 7-7-7" />
      </svg>
    </div>

    <!-- Center Play Button Overlay -> Jump straight to Step-by-Step Guide -->
    <button
      onclick={() => {
        isVideoPlaying = true;
        activeTab = "steps";
        document.getElementById("recipe-method-tabs")?.scrollIntoView({ behavior: "smooth" });
      }}
      class="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[#2B5A16] shadow-xl backdrop-blur-md transition-transform duration-200 hover:scale-110 active:scale-95 press focus:outline-none"
      aria-label="Jump to cooking steps"
    >
      <svg class="ml-1 h-7 w-7 fill-current" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>

    <!-- Bottom Right Duration / Prep Badge: "5 min prep" -->
    <div
      class="absolute bottom-3 right-3 rounded-md bg-black/75 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-bold text-white shadow"
    >
      {r.prepBadge || r.videoDuration || "5 min prep"}
    </div>
  </div>

  <!-- 2. Recipe Title & Wishlist Heart -->
  <div class="px-4 pt-4">
    <div class="flex items-start justify-between gap-3">
      <h1
        class="text-[1.75rem] font-bold leading-tight tracking-tight text-[#0B1F2E]"
        style="font-family: 'Playfair Display', Georgia, serif;"
      >
        {r.title}
      </h1>

      <!-- Wishlist Heart Button -->
      <button
        onclick={toggleFavorite}
        class="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F7F7F2] text-[#0B1F2E] border border-[#E4E4DC] hover:bg-white press transition-transform"
        aria-label="Save recipe to favorites"
      >
        {#if isSaved}
          <svg class="h-5 w-5 fill-red-500 text-red-500" viewBox="0 0 24 24">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
        {:else}
          <svg
            class="h-5 w-5 stroke-[#0B1F2E] stroke-2 fill-none"
            viewBox="0 0 24 24"
          >
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            />
          </svg>
        {/if}
      </button>
    </div>

    <!-- Metadata Row: Prep, Cook, Serves, Easy -->
    <div
      class="mt-2.5 flex flex-wrap items-center gap-2.5 text-xs text-[#4A5A52]"
    >
      <div class="flex items-center gap-1 font-medium">
        <svg
          class="h-3.5 w-3.5 text-[#2B5A16]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" /><polyline
            points="12 6 12 12 16 14"
          />
        </svg>
        <span>Prep: <strong>{r?.prepTime || recipe?.prepTime}</strong></span>
      </div>
      <span>•</span>
      <div class="flex items-center gap-1 font-medium">
        <span>Cook: <strong>{r?.cookTime || recipe?.cookTime}</strong></span>
      </div>
      <span>•</span>
      <div class="flex items-center gap-1 font-medium">
        <span>Serves: <strong>{selectedServings}</strong></span>
      </div>
      <span
        class="ml-1 rounded-md bg-[#EBF5D9] px-2 py-0.5 text-[10px] font-bold text-[#2B5A16] border border-[#A8D632]/40"
      >
        {r?.difficulty || recipe?.difficulty || "Easy"}
      </span>
    </div>

    <!-- Description Paragraph -->
    <p class="mt-3 text-[13.5px] leading-relaxed text-[#4A5A52]">
      {r?.subtitle ||
        r?.metaDescription ||
        recipe?.subtitle ||
        recipe?.metaDescription}
    </p>

    <!-- 3. NUTRIENT HIGHLIGHTS -->
    <div class="mt-4 pt-3 border-t border-[#E4E4DC]/80">
      <span
        class="block text-[10px] font-bold uppercase tracking-widest text-[#4A5A52]/80 mb-2"
      >
        Nutrient Highlights
      </span>
      <div class="flex flex-wrap gap-1.5">
        {#each r?.nutrientHighlights || recipe?.nutrientHighlights || ["High protein", "Low calorie", "Rich in B vitamins", "Good source of iron"] as highlight}
          <span
            class="inline-flex items-center gap-1 rounded-lg bg-[#F2F8EA] px-2.5 py-1 text-[11px] font-semibold text-[#2B5A16] border border-[#A8D632]/40"
          >
            <span class="text-[#2B5A16] font-bold">✓</span>
            {highlight}
          </span>
        {/each}
      </div>
    </div>
  </div>

  <!-- 4. Segmented 3-Tab Control: Ingredients | Steps | Notes -->
  <div class="px-4 pt-5">
    <div
      id="recipe-method-tabs"
      class="flex items-center gap-1.5 rounded-2xl bg-[#F7F7F2] p-1 border border-[#E4E4DC]"
    >
      <button
        onclick={() => (activeTab = "ingredients")}
        class={`flex-1 rounded-xl py-2 text-xs font-bold transition-all press ${
          activeTab === "ingredients"
            ? "bg-[#1E3F20] text-white shadow-xs"
            : "text-[#4A5A52] hover:text-[#0B1F2E]"
        }`}
      >
        Ingredients
      </button>

      <button
        onclick={() => (activeTab = "steps")}
        class={`flex-1 rounded-xl py-2 text-xs font-bold transition-all press ${
          activeTab === "steps"
            ? "bg-[#1E3F20] text-white shadow-xs"
            : "text-[#4A5A52] hover:text-[#0B1F2E]"
        }`}
      >
        Steps
      </button>

      <button
        onclick={() => (activeTab = "notes")}
        class={`flex-1 rounded-xl py-2 text-xs font-bold transition-all press ${
          activeTab === "notes"
            ? "bg-[#1E3F20] text-white shadow-xs"
            : "text-[#4A5A52] hover:text-[#0B1F2E]"
        }`}
      >
        Notes
      </button>
    </div>
  </div>

  <!-- 5. Active Tab Content -->
  <div class="px-4 pt-4">
    {#if activeTab === "ingredients"}
      <!-- INGREDIENTS LIST -->
      <div class="rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
        <div
          class="flex items-center justify-between pb-3 border-b border-[#E4E4DC]/80"
        >
          <h2
            class="text-base font-bold text-[#0B1F2E]"
            style="font-family: 'Playfair Display', Georgia, serif;"
          >
            Ingredients
          </h2>

          <!-- Servings Dropdown Pill -->
          <div class="relative inline-flex items-center">
            <select
              bind:value={selectedServings}
              class="appearance-none rounded-xl border border-[#E4E4DC] bg-[#F7F7F2] py-1.5 pl-3 pr-8 text-xs font-bold text-[#0B1F2E] focus:border-[#2B5A16] focus:outline-none"
            >
              <option value={1}>1 serving</option>
              <option value={2}>2 servings</option>
              <option value={4}>4 servings</option>
              <option value={6}>6 servings</option>
            </select>
            <svg
              class="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-[#4A5A52]"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
        </div>

        <ul class="mt-3.5 space-y-2.5 text-xs text-[#2A3B32]">
          {#if r?.ingredientsList?.length}
            {#each r.ingredientsList as ing}
              <li class="flex items-start gap-2.5">
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#84CC16]"
                ></span>
                <span class="leading-relaxed">
                  {#if ing.baseQty != null}
                    <strong class="font-bold text-[#0B1F2E]"
                      >{formatQty(ing.baseQty)}{ing.unit
                        ? ` ${ing.unit}`
                        : ""}</strong
                    >
                  {/if}
                  <span> {ing.name}</span>
                </span>
              </li>
            {/each}
          {:else if r?.ingredients?.length}
            {#each r.ingredients as ing}
              <li class="flex items-start gap-2.5">
                <span class="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#84CC16]"
                ></span>
                <span class="leading-relaxed">{ing}</span>
              </li>
            {/each}
          {/if}
        </ul>
      </div>
    {:else if activeTab === "steps"}
      <!-- STEPS LIST -->
      <div class="rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
        <h2
          class="text-base font-bold text-[#0B1F2E] pb-3 border-b border-[#E4E4DC]/80"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Step by Step Method
        </h2>
        <ol class="mt-3.5 space-y-3.5 text-xs text-[#2A3B32]">
          {#each r?.steps || [] as step, idx}
            <li class="flex items-start gap-3">
              <span
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E3F20] text-[11px] font-bold text-white shadow-2xs"
              >
                {idx + 1}
              </span>
              <p class="pt-0.5 leading-relaxed text-[#2A3B32]">{step}</p>
            </li>
          {/each}
        </ol>
      </div>
    {:else if activeTab === "notes"}
      <!-- NOTES -->
      <div class="rounded-2xl border border-[#E4E4DC] bg-white p-4 shadow-2xs">
        <h2
          class="text-base font-bold text-[#0B1F2E] pb-3 border-b border-[#E4E4DC]/80"
          style="font-family: 'Playfair Display', Georgia, serif;"
        >
          Chef Notes & Farm Secrets
        </h2>
        <ul class="mt-3.5 space-y-3 text-xs text-[#2A3B32]">
          {#if r?.chefNotes?.length}
            {#each r.chefNotes as note}
              <li class="flex items-start gap-2.5">
                <span class="text-base leading-none">💡</span>
                <p class="leading-relaxed">{note}</p>
              </li>
            {/each}
          {:else}
            <li class="flex items-start gap-2.5">
              <span class="text-base leading-none">🍄</span>
              <p class="leading-relaxed">
                Always tear oyster mushrooms rather than cutting with a knife
                for maximum crisp surface area.
              </p>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="text-base leading-none">🔥</span>
              <p class="leading-relaxed">
                A screaming hot pan seals in natural umami without releasing
                water.
              </p>
            </li>
          {/if}
        </ul>
      </div>
    {/if}
  </div>

  <!-- 5.5 Complete Recipe Farm Harvest Bundle (AOV Booster) -->
  <div class="px-4 pt-4">
    <div
      class="overflow-hidden rounded-2xl border border-[#A8D632] bg-gradient-to-r from-[#F7FAF0] via-[#FAFDF5] to-[#EFF7E4] p-4 shadow-xs"
    >
      <div
        class="flex items-center justify-between pb-2 border-b border-[#A8D632]/40"
      >
        <div class="flex items-center gap-1.5">
          <span class="text-base">🧺</span>
          <span
            class="text-[11px] font-extrabold uppercase tracking-wider text-[#2B5A16]"
          >
            "Cook This Dish" Farm Harvest Bundle
          </span>
        </div>
        <span
          class="rounded-full bg-[#2B5A16] px-2 py-0.5 text-[9.5px] font-bold text-white shadow-xs"
        >
          Save ₹{bundleSavingsAmount} Bundle
        </span>
      </div>

      <div class="mt-3 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <!-- Main produce thumbnail -->
          <img
            src={activeProduct?.image || r?.thumbnail}
            alt="Main harvest"
            class="h-11 w-11 rounded-xl object-cover border border-[#E4E4DC] shadow-2xs"
          />
          <span class="text-xs font-bold text-[#4A5A52]">+</span>
          <!-- Garnish thumbnail -->
          <img
            src="/images/prod-microgreens-mix.jpg"
            alt="Microgreens garnish"
            class="h-11 w-11 rounded-xl object-cover border border-[#E4E4DC] shadow-2xs"
          />
          <div class="pl-1">
            <p class="text-xs font-bold text-[#0B1F2E] leading-tight">
              {activeProduct?.name || r?.product || "Oyster Mushrooms"} + Living Microgreens
            </p>
            <p class="text-[10.5px] text-[#4A5A52]">
              Fresh harvest main + crisp nutrient garnish
            </p>
          </div>
        </div>

        <div class="text-right shrink-0">
          <span class="text-xs text-[#9CA3AF] line-through block"
            >₹{selectedPack.price + garnishOriginalPrice}</span
          >
          <span class="text-sm font-extrabold text-[#2B5A16]"
            >₹{selectedPack.price + garnishBundlePrice}</span
          >
        </div>
      </div>

      {#if stockStatus === "OUT_OF_STOCK"}
        <button
          disabled
          class="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl bg-slate-200 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed border border-slate-300"
        >
          <span>Sold Out for Today 🍄</span>
        </button>
      {:else}
        <button
          type="button"
          onclick={handleAddBundleToCart}
          class="mt-3.5 w-full flex items-center justify-center gap-2 rounded-xl bg-[#2B5A16] py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1E3F20] active:scale-98 transition-all"
        >
          {#if bundleAddedFeedback}
            <span>✓ Both Harvest Items Added to Bag!</span>
          {:else}
            <span>🛒</span>
            <span>Add Recipe Bundle to Bag (₹{selectedPack.price + garnishBundlePrice})</span>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- 6. Fresh Produce Purchase Bar (Screen 2 Exact Match) -->
  <div class="px-4 pt-4">
    <div
      class="rounded-2xl border border-[#E4E4DC] bg-[#F7F7F2]/90 p-3.5 shadow-xs"
    >
      <div class="flex items-center justify-between gap-3">
        <!-- Price & Product Label on Left -->
        <div>
          <div class="text-[1.35rem] font-bold text-[#0B1F2E] leading-tight">
            ₹{selectedPack.price}
          </div>
          <div class="text-[11px] font-medium text-[#4A5A52] mt-0.5">
            {r?.product || product?.name || "Grey Oyster Mushrooms"} ({selectedPack.size})
          </div>
        </div>

        <!-- Action Buttons: [ Add to Cart ] & [ Buy Now ] on Right -->
        <div class="flex items-center gap-2">
          {#if stockStatus === "OUT_OF_STOCK"}
            <button
              disabled
              class="rounded-xl bg-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed border border-slate-300"
            >
              Sold Out
            </button>
          {:else}
            <!-- Add to Cart (soft green button) -->
            <button
              onclick={handleAddToCart}
              class="rounded-xl bg-[#EBF5D9] hover:bg-[#E0EFC9] px-3.5 py-2.5 text-xs font-bold text-[#2B5A16] transition-all press border border-[#A8D632]/40"
            >
              {addedFeedback ? "Added! ✓" : "Add to Cart"}
            </button>

            <!-- Buy Now (solid brand green button) -->
            <button
              onclick={handleBuyNow}
              class="rounded-xl bg-[#2B5A16] hover:bg-[#224711] px-4 py-2.5 text-xs font-bold text-white transition-all press shadow-xs"
            >
              Buy Now
            </button>
          {/if}
        </div>
      </div>

      <!-- Quick toggle to switch to Weekly Subscription Routine -->
      <div
        class="mt-3 pt-2.5 border-t border-[#E4E4DC]/80 flex items-center justify-between"
      >
        <button
          onclick={() => (showWeeklyBox = !showWeeklyBox)}
          class="text-[11px] font-bold text-[#2B5A16] hover:underline inline-flex items-center gap-1"
        >
          <span
            >🌱 {showWeeklyBox
              ? "Hide Weekly Box Subscription"
              : "Subscribe Weekly & Save"}</span
          >
          <svg
            class={`h-3 w-3 transition-transform ${showWeeklyBox ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <span class="text-[10px] text-[#4A5A52]">Pause or cancel anytime</span>
      </div>

      <!-- Expandable Weekly Box Routine Selector -->
      {#if showWeeklyBox}
        <div class="mt-3 pt-3 border-t border-[#E4E4DC] space-y-3">
          <!-- Frequency -->
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              onclick={() => setRecipeFrequency("1x")}
              class={`rounded-xl border p-2 text-left text-xs ${
                frequency === "1x"
                  ? "border-[#2B5A16] bg-white ring-1 ring-[#2B5A16]"
                  : "border-[#E4E4DC] bg-white"
              }`}
            >
              <div class="font-bold text-[#0B1F2E]">Every Week (1x)</div>
              <div class="text-[10px] text-[#2B5A16] font-semibold">
                ₹{selectedPack.price}/week
              </div>
            </button>
            <button
              type="button"
              onclick={() => setRecipeFrequency("2x")}
              class={`rounded-xl border p-2 text-left text-xs ${
                frequency === "2x"
                  ? "border-[#2B5A16] bg-white ring-1 ring-[#2B5A16]"
                  : "border-[#E4E4DC] bg-white"
              }`}
            >
              <div class="font-bold text-[#0B1F2E]">Twice a Week (2x)</div>
              <div class="text-[10px] text-[#2B5A16] font-semibold">
                ₹{selectedPack.price * 2}/week
              </div>
            </button>
          </div>

          <!-- Delivery Day Selection -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-[10.5px] font-bold text-[#4A5A52]">
              <span>{frequency === "2x" ? `Select 2 Days (${deliveryDays.length}/2)` : "Select Delivery Day"}</span>
              <span class="text-[#2B5A16]">Every {formattedDeliveryDays}</span>
            </div>
            <div class="grid grid-cols-6 gap-1">
              {#each weekDays as wd}
                {@const isPicked = deliveryDays.includes(wd.full)}
                <button
                  type="button"
                  onclick={() => toggleRecipeDeliveryDay(wd.full)}
                  class="rounded-lg border py-1.5 text-[10px] font-bold transition-colors {isPicked
                    ? 'border-[#2B5A16] bg-[#2B5A16] text-white'
                    : 'border-[#E4E4DC] bg-white text-[#4A5A52]'}"
                >
                  {wd.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Start Weekly Box Routine CTA -->
          <button
            onclick={handleSubscribeWhatsApp}
            class="w-full rounded-xl bg-[#2B5A16] py-2.5 text-center text-xs font-bold text-white press shadow-xs"
          >
            Start Weekly Routine on WhatsApp →
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- 7. "More Mushroom Recipes" Recommendations (Screen 2 Exact Match) -->
  <div class="px-4 pt-7">
    <div class="flex items-center justify-between mb-3">
      <h3
        class="text-[1.2rem] font-bold text-[#0B1F2E]"
        style="font-family: 'Playfair Display', Georgia, serif;"
      >
        More Mushroom Recipes
      </h3>
      <a
        href="/recipes"
        class="text-xs font-bold text-[#2B5A16] hover:text-[#1e3f0f] transition-colors inline-flex items-center gap-1"
      >
        <span>See All</span>
        <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
            clip-rule="evenodd"
          />
        </svg>
      </a>
    </div>

    <!-- 3 Video Recipe Recommendation Cards -->
    <div class="grid grid-cols-3 gap-2.5">
      {#each relatedRecipes as rel}
        <a
          href={`/recipes/${rel.slug}`}
          class="group block overflow-hidden rounded-xl border border-[#E4E4DC] bg-white shadow-2xs hover:border-[#A8D632] hover:shadow-xs transition-all press"
        >
          <!-- Thumbnail with play button and duration -->
          <div
            class="relative aspect-square w-full overflow-hidden bg-[#0B1F2E]"
          >
            <img
              src={rel.thumbnail}
              alt={rel.title}
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div
              class="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"
            ></div>

            <!-- Play icon -->
            <div class="absolute inset-0 flex items-center justify-center">
              <div
                class="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#2B5A16] shadow-xs"
              >
                <svg class="h-3 w-3 ml-0.5 fill-current" viewBox="0 0 24 24"
                  ><path d="M8 5v14l11-7z" /></svg
                >
              </div>
            </div>

            <!-- Duration pill badge -->
            <div
              class="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.2 text-[9px] font-bold text-white"
            >
              {rel.videoDuration || "8 min"}
            </div>
          </div>

          <!-- Title -->
          <div class="p-2">
            <h4
              class="text-[11px] font-bold text-[#0B1F2E] leading-snug line-clamp-2 group-hover:text-[#2B5A16] transition-colors"
            >
              {rel.title}
            </h4>
          </div>
        </a>
      {/each}
    </div>
  </div>
</div>
