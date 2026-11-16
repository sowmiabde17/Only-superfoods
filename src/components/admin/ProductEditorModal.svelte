<!--
  ProductEditorModal.svelte — High-Density Desktop Modal for Adding & Editing Products
  Supports multi-pack pricing (e.g. 50g / 100g / 500g) synced directly with Supabase.
  Svelte 5 runes mode.
-->
<script>
  import { addProduct, updateProduct, normalizeCategoryName } from '../../lib/productsStore.js';

  /** @type {{ product?: object|null, onClose: () => void, onSaved: (p: object, metaSync?: object) => void }} */
  let { product = null, onClose, onSaved } = $props();

  let isEditing = $derived(Boolean(product && product.id));

  // Form states initialized with defaults
  let name = $state('');
  let category = $state('Mushrooms');
  let packSizes = $state([{ size: '250 g', price: 120 }]);
  let badge = $state('Fresh Harvest');
  let badgeType = $state('green');
  let shortDescription = $state('Fresh morning harvest from Kadugodi.');
  let shelfLife = $state('5 to 7 days in refrigerator');
  let storageGuide = $state(
    'Keep unwashed in breathable kraft punnet in crisper drawer (4°C - 7°C).'
  );
  let culinaryTips = $state('Pan-sear in hot skillet with butter or ghee for 3-4 minutes.');
  let image = $state('/images/prod-grey-oyster.jpg');

  // Synchronize with incoming product prop
  $effect(() => {
    if (product) {
      name = product.name || '';
      category = normalizeCategoryName(product.category || 'Mushrooms');
      packSizes =
        product.packSizes?.length > 0
          ? product.packSizes.map((ps) => ({ size: ps.size, price: Number(ps.price) }))
          : [{ size: product.unit || '250 g', price: Number(product.price || 120) }];
      badge = product.badge || 'Fresh Harvest';
      badgeType = product.badgeType || 'green';
      shortDescription = product.shortDescription || 'Fresh morning harvest from Kadugodi.';
      shelfLife = product.shelfLife || '5 to 7 days in refrigerator';
      storageGuide =
        product.storageGuide ||
        'Keep unwashed in breathable kraft punnet in crisper drawer (4°C - 7°C).';
      culinaryTips =
        product.culinaryTips || 'Pan-sear in hot skillet with butter or ghee for 3-4 minutes.';
      image = product.image || '/images/prod-grey-oyster.jpg';
    } else {
      name = '';
      category = 'Mushrooms';
      packSizes = [{ size: '250 g', price: 120 }];
      badge = 'Fresh Harvest';
      badgeType = 'green';
      shortDescription = 'Fresh morning harvest from Kadugodi.';
      shelfLife = '5 to 7 days in refrigerator';
      storageGuide = 'Keep unwashed in breathable kraft punnet in crisper drawer (4°C - 7°C).';
      culinaryTips = 'Pan-sear in hot skillet with butter or ghee for 3-4 minutes.';
      image = '/images/prod-grey-oyster.jpg';
    }
  });

  let errorMsg = $state('');
  let isSaving = $state(false);

  const imagePresets = [
    { label: 'Grey Oyster', url: '/images/prod-grey-oyster.jpg' },
    { label: 'Pink Oyster', url: '/images/prod-pink-oyster.jpg' },
    { label: 'Mixed Oyster', url: '/images/prod-mixed-oyster.jpg' },
    { label: 'Microgreens Mix', url: '/images/prod-microgreens-mix.jpg' },
    { label: 'Radish Greens', url: '/images/prod-radish-microgreens.jpg' },
    { label: 'Kombucha', url: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp' },
    { label: 'Desi Eggs', url: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp' },
  ];

  function addPackOption() {
    packSizes = [...packSizes, { size: '', price: 100 }];
  }

  function removePackOption(idx) {
    if (packSizes.length <= 1) return;
    packSizes = packSizes.filter((_, i) => i !== idx);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    errorMsg = '';

    if (!name.trim()) {
      errorMsg = 'Product name is required.';
      return;
    }

    const cleanedPacks = packSizes
      .map((ps) => ({ size: (ps.size || '').trim(), price: Number(ps.price) }))
      .filter((ps) => ps.size && Number.isFinite(ps.price) && ps.price > 0);

    if (cleanedPacks.length === 0) {
      errorMsg = 'Please enter at least one valid pack size and price in ₹ (> 0).';
      return;
    }

    const payload = {
      name: name.trim(),
      category: normalizeCategoryName(category),
      price: cleanedPacks[0].price,
      unit: cleanedPacks[0].size,
      badge: badge.trim(),
      badgeType,
      shortDescription: shortDescription.trim(),
      shelfLife: shelfLife.trim(),
      storageGuide: storageGuide.trim(),
      culinaryTips: culinaryTips.trim(),
      image: image.trim(),
      packSizes: cleanedPacks,
    };

    isSaving = true;
    try {
      if (isEditing && product?.id) {
        const res = await updateProduct(product.id, payload);
        if (!res.success) throw new Error(res.error || 'Failed to update product');
        onSaved(res.product, res.metaSync);
      } else {
        const res = await addProduct(payload);
        if (!res.success) throw new Error(res.error || 'Failed to create product');
        onSaved(res.product, res.metaSync);
      }
      onClose();
    } catch (err) {
      errorMsg = err?.message || 'Failed to save product. Check database connection.';
    } finally {
      isSaving = false;
    }
  }
</script>

<!-- Backdrop -->
<div
  class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
  onclick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
  role="presentation"
>
  <!-- Modal Card -->
  <div
    class="relative w-full max-w-2xl rounded-3xl border border-[#D5E2C4] bg-white p-6 sm:p-8 shadow-2xl my-8"
    role="dialog"
    aria-modal="true"
    aria-labelledby="prod-editor-title"
  >
    <!-- Modal Header -->
    <div class="flex items-center justify-between pb-4 mb-4 border-b border-[#E4E4DC]">
      <div>
        <h2 id="prod-editor-title" class="text-xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', serif;">
          {isEditing ? `Edit "${product?.name}"` : 'Add New Harvest Produce'}
        </h2>
        <p class="text-xs text-[#4A5A52] mt-0.5">
          Changes immediately sync with storefront &amp; Meta Commerce catalog.
        </p>
      </div>

      <button
        type="button"
        onclick={onClose}
        disabled={isSaving}
        class="h-8 w-8 rounded-full border border-[#D5E2C4] flex items-center justify-center text-slate-400 hover:text-[#0B1F2E] hover:border-slate-400 transition-colors cursor-pointer"
        aria-label="Close modal"
      >
        ✕
      </button>
    </div>

    {#if errorMsg}
      <div class="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
        ⚠️ {errorMsg}
      </div>
    {/if}

    <!-- Form -->
    <form onsubmit={handleSubmit} class="space-y-4">
      <!-- 2-Column Row 1: Name & Category -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="pem-name" class="block text-xs font-bold text-[#0B1F2E] mb-1">Product Name *</label>
          <input
            id="pem-name"
            type="text"
            bind:value={name}
            placeholder="e.g. Elm Oyster Mushrooms"
            class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
            required
          />
        </div>

        <div>
          <label for="pem-category" class="block text-xs font-bold text-[#0B1F2E] mb-1">Category *</label>
          <select
            id="pem-category"
            bind:value={category}
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F] bg-white cursor-pointer"
          >
            <option value="Mushrooms">🍄 Gourmet Mushrooms</option>
            <option value="Microgreens">🌱 Living Microgreens</option>
            <option value="Kombucha">🍾 Raw Kombucha</option>
            <option value="Desi Eggs">🥚 Free-Range Desi Eggs</option>
            <option value="Elixirs">🌿 Farm Elixirs &amp; Picks</option>
          </select>
        </div>
      </div>

      <!-- Pack Sizes & Pricing Matrix (Primary + Variants) -->
      <div class="rounded-2xl border border-[#D5E2C4] bg-[#FAFBF7] p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="block text-xs font-bold text-[#0B1F2E]">Pack Weights &amp; Live Prices (₹) *</div>
            <p class="text-[11px] text-[#4A5A52]">
              Pack #1 sets the default card price &amp; primary WhatsApp variant; extra rows appear as pack options.
            </p>
          </div>
          <button
            type="button"
            onclick={addPackOption}
            class="rounded-lg bg-[#EBF7DC] border border-[#A8D632] px-2.5 py-1 text-[11px] font-bold text-[#2B5A16] hover:bg-[#dcf0c2] cursor-pointer"
          >
            + Add Pack Size
          </button>
        </div>

        <div class="space-y-2">
          {#each packSizes as pack, idx}
            <div class="grid grid-cols-12 gap-2 items-center">
              <div class="col-span-6">
                <input
                  type="text"
                  bind:value={pack.size}
                  placeholder={idx === 0 ? 'e.g. 50 g' : 'e.g. 100 g'}
                  aria-label="Pack weight or unit"
                  class="w-full rounded-xl border border-[#D5E2C4] bg-white px-3 py-2 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F]"
                  required
                />
              </div>
              <div class="col-span-5 relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#4A5A52]">₹</span>
                <input
                  type="number"
                  bind:value={pack.price}
                  min="1"
                  step="1"
                  placeholder="Price"
                  aria-label="Pack price in Rupees"
                  class="w-full rounded-xl border border-[#D5E2C4] bg-white pl-7 pr-3 py-2 text-xs font-bold text-[#0B1F2E] outline-none focus:border-[#8DC63F]"
                  required
                />
              </div>
              <div class="col-span-1 flex justify-center">
                {#if idx > 0}
                  <button
                    type="button"
                    onclick={() => removePackOption(idx)}
                    class="h-7 w-7 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 cursor-pointer"
                    aria-label="Remove pack size"
                  >
                    ✕
                  </button>
                {:else}
                  <span class="text-[9px] font-extrabold uppercase text-[#2B5A16] bg-[#EBF7DC] px-1.5 py-0.5 rounded">Primary</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- 2-Column Row 3: Badge Tag & Color -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="pem-badge" class="block text-xs font-bold text-[#0B1F2E] mb-1">Badge Tag</label>
          <input
            id="pem-badge"
            type="text"
            bind:value={badge}
            placeholder="e.g. Fresh Harvest, Bestseller, Chef's Pick"
            class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
          />
        </div>

        <div>
          <label for="pem-badge-type" class="block text-xs font-bold text-[#0B1F2E] mb-1">Badge Color</label>
          <select
            id="pem-badge-type"
            bind:value={badgeType}
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F] bg-white cursor-pointer"
          >
            <option value="green">🟢 Fresh Green</option>
            <option value="orange">🟠 Bestseller Orange</option>
          </select>
        </div>
      </div>

      <!-- Description -->
      <div>
        <label for="pem-desc" class="block text-xs font-bold text-[#0B1F2E] mb-1">Short Description</label>
        <textarea
          id="pem-desc"
          bind:value={shortDescription}
          rows="2"
          placeholder="Tender, velvety caps harvested same morning in Kadugodi."
          class="w-full rounded-xl border border-[#D5E2C4] p-3 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
        ></textarea>
      </div>

      <!-- Storage & Shelf Life Guide -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="pem-shelf" class="block text-xs font-bold text-[#0B1F2E] mb-1">Shelf Life Guide</label>
          <input
            id="pem-shelf"
            type="text"
            bind:value={shelfLife}
            placeholder="e.g. 5 to 7 days in refrigerator"
            class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
          />
        </div>

        <div>
          <label for="pem-storage" class="block text-xs font-bold text-[#0B1F2E] mb-1">Crisper Storage Tip</label>
          <input
            id="pem-storage"
            type="text"
            bind:value={storageGuide}
            placeholder="e.g. Store unwashed in breathable paper punnet"
            class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
          />
        </div>
      </div>

      <!-- Image Selection / Presets -->
      <div>
        <label for="pem-image" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">Product Image</label>
        <div class="flex flex-wrap gap-2 mb-2">
          {#each imagePresets as preset}
            <button
              type="button"
              onclick={() => (image = preset.url)}
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all {image === preset.url ? 'border-[#2B5A16] bg-[#EBF7DC] text-[#2B5A16] font-bold' : 'border-[#E4E4DC] text-[#4A5A52] hover:bg-slate-50'}"
            >
              <img src={preset.url} alt={preset.label} class="h-4 w-4 rounded-full object-cover" />
              <span>{preset.label}</span>
            </button>
          {/each}
        </div>
        <input
          id="pem-image"
          type="text"
          bind:value={image}
          placeholder="/images/prod-example.jpg or https://..."
          class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2 text-xs text-[#0B1F2E] outline-none font-mono text-[11px]"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#E4E4DC]">
        <button
          type="button"
          onclick={onClose}
          disabled={isSaving}
          class="rounded-xl border border-[#D5E2C4] px-4 py-2.5 text-xs font-bold text-[#4A5A52] hover:bg-[#F5F5F0] transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          class="rounded-xl bg-[#2B5A16] hover:bg-[#1e3f0f] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          {#if isSaving}
            <span>Saving...</span>
          {:else}
            <span>{isEditing ? 'Save Changes' : 'Publish Product'}</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>
