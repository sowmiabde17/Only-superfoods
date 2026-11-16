<!--
  RecipeEditorModal.svelte — High-Density Desktop Modal for Adding & Editing Recipes
  Svelte 5 runes mode.
-->
<script>
  import { addRecipe, updateRecipe } from '../../lib/recipesStore.js';
  import { getProducts } from '../../lib/productsStore.js';

  /** @type {{ recipe?: object|null, onClose: () => void, onSaved: (r: object) => void }} */
  let { recipe = null, onClose, onSaved } = $props();

  let isEditing = $derived(Boolean(recipe && (recipe.slug || recipe.id)));

  const productsList = getProducts();

  // Form states initialized with defaults
  let title = $state('');
  let category = $state('Mushrooms');
  let prepTime = $state('10 min');
  let cookTime = $state('15 min');
  let servings = $state(2);
  let difficulty = $state('Easy');
  let thumbnail = $state('/images/recipe-garlic-butter-mushrooms.jpg');
  let chefTip = $state('Tear mushrooms rather than knife-cutting to preserve fiber texture.');
  let selectedProductId = $state(productsList[0]?.id || 'grey-oyster');
  let ingredients = $state([
    '250g fresh oyster mushrooms',
    '2 tbsp pure butter or A2 ghee',
    '4 cloves garlic, thinly sliced',
    'Salt and freshly cracked black pepper',
  ]);
  let steps = $state([
    'Tear mushrooms along the grain into bite-sized clusters.',
    'Heat a wide skillet until hot, add butter and sear mushrooms without moving for 3 minutes.',
    'Flip, toss in minced garlic and seasonings, and serve sizzling hot!',
  ]);

  // Synchronize with incoming recipe prop
  $effect(() => {
    if (recipe) {
      title = recipe.title || '';
      category = recipe.category || 'Mushrooms';
      prepTime = recipe.prepTime || '10 min';
      cookTime = recipe.cookTime || '15 min';
      servings = recipe.servings || 2;
      difficulty = recipe.difficulty || 'Easy';
      thumbnail = recipe.thumbnail || '/images/recipe-garlic-butter-mushrooms.jpg';
      chefTip =
        recipe.chefNotes?.[0] || 'Tear mushrooms rather than knife-cutting to preserve fiber texture.';
      selectedProductId = recipe.productId || productsList[0]?.id || 'grey-oyster';
      ingredients = recipe.ingredients?.length
        ? [...recipe.ingredients]
        : [
            '250g fresh oyster mushrooms',
            '2 tbsp pure butter or A2 ghee',
            '4 cloves garlic, thinly sliced',
            'Salt and freshly cracked black pepper',
          ];
      steps = recipe.steps?.length
        ? [...recipe.steps]
        : [
            'Tear mushrooms along the grain into bite-sized clusters.',
            'Heat a wide skillet until hot, add butter and sear mushrooms without moving for 3 minutes.',
            'Flip, toss in minced garlic and seasonings, and serve sizzling hot!',
          ];
    } else {
      title = '';
      category = 'Mushrooms';
      prepTime = '10 min';
      cookTime = '15 min';
      servings = 2;
      difficulty = 'Easy';
      thumbnail = '/images/recipe-garlic-butter-mushrooms.jpg';
      chefTip = 'Tear mushrooms rather than knife-cutting to preserve fiber texture.';
      selectedProductId = productsList[0]?.id || 'grey-oyster';
      ingredients = [
        '250g fresh oyster mushrooms',
        '2 tbsp pure butter or A2 ghee',
        '4 cloves garlic, thinly sliced',
        'Salt and freshly cracked black pepper',
      ];
      steps = [
        'Tear mushrooms along the grain into bite-sized clusters.',
        'Heat a wide skillet until hot, add butter and sear mushrooms without moving for 3 minutes.',
        'Flip, toss in minced garlic and seasonings, and serve sizzling hot!',
      ];
    }
  });

  let newIngredient = $state('');
  let newStep = $state('');
  let errorMsg = $state('');
  let isSaving = $state(false);

  const recipeThumbPresets = [
    { label: 'Garlic Butter', url: '/images/recipe-garlic-butter-mushrooms.jpg' },
    { label: 'Creamy Pasta', url: '/images/recipe-creamy-mushroom-pasta.jpg' },
    { label: 'Stir Fry', url: '/images/recipe-mushroom-stir-fry.jpg' },
    { label: 'Mushroom Soup', url: '/images/recipe-mushroom-soup.jpg' },
    { label: 'Fried Rice', url: '/images/recipe-mushroom-fried-rice.jpg' },
    { label: 'Farm Feast Hero', url: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/botton.webp' },
    { label: 'Microgreen Salad', url: '/images/recipe-microgreen-salad.jpg' },
    { label: 'Egg Bhurji', url: '/images/recipe-egg-bhurji.jpg' },
    { label: 'Kombucha Mocktail', url: '/images/recipe-kombucha-mocktail.jpg' },
  ];

  function addIngredientItem() {
    if (!newIngredient.trim()) return;
    ingredients = [...ingredients, newIngredient.trim()];
    newIngredient = '';
  }

  function removeIngredientItem(index) {
    ingredients = ingredients.filter((_, idx) => idx !== index);
  }

  function addStepItem() {
    if (!newStep.trim()) return;
    steps = [...steps, newStep.trim()];
    newStep = '';
  }

  function removeStepItem(index) {
    steps = steps.filter((_, idx) => idx !== index);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    errorMsg = '';

    if (!title.trim()) {
      errorMsg = 'Recipe title is required.';
      return;
    }

    const linkedProd = productsList.find((p) => p.id === selectedProductId) || productsList[0];
    if (ingredients.length === 0) {
      errorMsg = 'Please add at least one ingredient.';
      return;
    }

    if (steps.length === 0) {
      errorMsg = 'Please add at least one cooking step.';
      return;
    }

    const payload = {
      title: title.trim(),
      category,
      prepTime: prepTime.trim(),
      cookTime: cookTime.trim(),
      servings: Number(servings),
      difficulty,
      thumbnail: thumbnail.trim(),
      product: linkedProd?.name || 'Fresh Produce',
      productId: selectedProductId || linkedProd?.id || 'grey-oyster',
      productPackPrice: linkedProd?.price || 100,
      productPackSize: linkedProd?.unit || '250 g',
      ingredients: [...ingredients],
      steps: [...steps],
      chefNotes: chefTip ? [chefTip.trim()] : [],
    };

    isSaving = true;
    try {
      let res;
      if (isEditing && (recipe?.slug || recipe?.id)) {
        res = await updateRecipe(recipe.slug || recipe.id, payload);
      } else {
        res = await addRecipe(payload);
      }
      if (!res?.success) throw new Error(res?.error || 'Failed to save recipe');
      onSaved?.(res.recipe);
      onClose?.();
    } catch (err) {
      errorMsg = err?.message || 'Failed to save recipe. Please check details.';
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
    class="relative w-full max-w-2xl rounded-3xl border border-[#D5E2C4] bg-white p-6 sm:p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rec-editor-title"
  >
    <!-- Modal Header -->
    <div class="flex items-center justify-between border-b border-[#E4E4DC] pb-4 mb-6">
      <div class="flex items-center gap-2.5">
        <span class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF3E8] text-xl">
          🍳
        </span>
        <div>
          <h2 id="rec-editor-title" class="text-xl font-bold text-[#0B1F2E]" style="font-family: 'Playfair Display', Georgia, serif;">
            {isEditing ? `Edit Recipe: ${recipe?.title}` : 'Add New Farm Harvest Recipe'}
          </h2>
          <p class="text-xs text-[#4A5A52]">
            Creates culinary content with 1-click linked harvest bundle checkout for customers.
          </p>
        </div>
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

    <form onsubmit={handleSubmit} class="space-y-5">
      <!-- 2-Column: Title & Category -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="rem-title" class="block text-xs font-bold text-[#0B1F2E] mb-1">Recipe Title *</label>
          <input
            id="rem-title"
            type="text"
            bind:value={title}
            placeholder="e.g. Szechuan Pink Oyster Pan-Sear"
            class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F]"
            required
          />
        </div>

        <div>
          <label for="rem-category" class="block text-xs font-bold text-[#0B1F2E] mb-1">Category / Tag *</label>
          <select
            id="rem-category"
            bind:value={category}
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F] bg-white cursor-pointer"
          >
            <option value="Mushrooms">🍄 Gourmet Mushrooms</option>
            <option value="Microgreens">🌱 Living Microgreens</option>
            <option value="Kombucha">🌿 Farm Elixirs / Kombucha</option>
            <option value="Desi Eggs">🥚 Desi Eggs</option>
          </select>
        </div>
      </div>

      <!-- Linked Farm Produce (powers 1-Click "Cook This Dish Bundle") -->
      <div class="rounded-2xl border border-[#E1EAD2] bg-[#FAFBF7] p-3.5">
        <label for="rem-linked-prod" class="block text-xs font-bold text-[#2B5A16] mb-1">
          🔗 Linked Farm Harvest Produce (For 1-Click Bundle Checkout)
        </label>
        <p class="text-[11px] text-[#4A5A52] mb-2">
          Selecting a produce item automatically puts a "Cook This Dish — Add Fresh Bundle to Bag" button on the recipe page!
        </p>
        <select
          id="rem-linked-prod"
          bind:value={selectedProductId}
          class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2.5 text-xs text-[#0B1F2E] outline-none focus:border-[#8DC63F] focus:ring-1 focus:ring-[#8DC63F] bg-white cursor-pointer"
        >
          {#each productsList as prod}
            <option value={prod.id}>
              {prod.name} ({prod.unit} — ₹{prod.price})
            </option>
          {/each}
        </select>
      </div>

      <!-- Timing & Servings (4-column row) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label for="rem-prep-time" class="block text-xs font-bold text-[#0B1F2E] mb-1">Prep Time</label>
          <input
            id="rem-prep-time"
            type="text"
            bind:value={prepTime}
            placeholder="5 min"
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2 text-xs text-[#0B1F2E] outline-none"
          />
        </div>
        <div>
          <label for="rem-cook-time" class="block text-xs font-bold text-[#0B1F2E] mb-1">Cook Time</label>
          <input
            id="rem-cook-time"
            type="text"
            bind:value={cookTime}
            placeholder="10 min"
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2 text-xs text-[#0B1F2E] outline-none"
          />
        </div>
        <div>
          <label for="rem-servings" class="block text-xs font-bold text-[#0B1F2E] mb-1">Servings</label>
          <input
            id="rem-servings"
            type="number"
            bind:value={servings}
            min="1"
            max="12"
            class="w-full rounded-xl border border-[#D5E2C4] px-3 py-2 text-xs text-[#0B1F2E] outline-none"
          />
        </div>
        <div>
          <label for="rem-diff" class="block text-xs font-bold text-[#0B1F2E] mb-1">Difficulty</label>
          <select
            id="rem-diff"
            bind:value={difficulty}
            class="w-full rounded-xl border border-[#D5E2C4] px-2.5 py-2 text-xs text-[#0B1F2E] outline-none bg-white cursor-pointer"
          >
            <option value="Easy">Easy (Beginner)</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Masterchef">Chef Special</option>
          </select>
        </div>
      </div>

      <!-- Ingredients List Editor -->
      <div class="rounded-2xl border border-[#E4E4DC] p-3.5 bg-white">
        <div class="block text-xs font-bold text-[#0B1F2E] mb-2">
          📝 Ingredients List ({ingredients.length} items)
        </div>
        <div class="space-y-1.5 mb-2.5 max-h-36 overflow-y-auto">
          {#each ingredients as ing, i}
            <div class="flex items-center justify-between gap-2 rounded-lg bg-[#FAFBF7] px-3 py-1.5 text-xs border border-[#E4E4DC]/60">
              <span class="text-[#0B1F2E]">• {ing}</span>
              <button
                type="button"
                onclick={() => removeIngredientItem(i)}
                class="text-xs text-red-500 hover:text-red-700 font-bold px-1.5"
                aria-label="Remove ingredient {ing}"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newIngredient}
            placeholder="Add ingredient (e.g. 2 tbsp toasted sesame oil)"
            aria-label="New ingredient name"
            class="flex-1 rounded-xl border border-[#D5E2C4] px-3 py-2 text-xs text-[#0B1F2E] outline-none"
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredientItem(); } }}
          />
          <button
            type="button"
            onclick={addIngredientItem}
            class="rounded-xl bg-[#EBF7DC] border border-[#A8D632] px-3 py-2 text-xs font-bold text-[#2B5A16] hover:bg-[#d8f0be] cursor-pointer"
          >
            + Add
          </button>
        </div>
      </div>

      <!-- Cooking Steps Editor -->
      <div class="rounded-2xl border border-[#E4E4DC] p-3.5 bg-white">
        <div class="block text-xs font-bold text-[#0B1F2E] mb-2">
          🍳 Cooking Steps ({steps.length} steps)
        </div>
        <div class="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto">
          {#each steps as step, i}
            <div class="flex items-start justify-between gap-2 rounded-lg bg-[#FAFBF7] px-3 py-2 text-xs border border-[#E4E4DC]/60">
              <span class="text-[#0B1F2E]"><strong class="text-[#2B5A16] font-mono">{i + 1}.</strong> {step}</span>
              <button
                type="button"
                onclick={() => removeStepItem(i)}
                class="text-xs text-red-500 hover:text-red-700 font-bold px-1.5 shrink-0"
                aria-label="Remove step {i + 1}"
              >
                ✕
              </button>
            </div>
          {/each}
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={newStep}
            placeholder="Add next cooking step..."
            aria-label="New cooking step description"
            class="flex-1 rounded-xl border border-[#D5E2C4] px-3 py-2 text-xs text-[#0B1F2E] outline-none"
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStepItem(); } }}
          />
          <button
            type="button"
            onclick={addStepItem}
            class="rounded-xl bg-[#EBF7DC] border border-[#A8D632] px-3 py-2 text-xs font-bold text-[#2B5A16] hover:bg-[#d8f0be] cursor-pointer"
          >
            + Add Step
          </button>
        </div>
      </div>

      <!-- Chef Tip -->
      <div>
        <label for="rem-cheftip" class="block text-xs font-bold text-[#0B1F2E] mb-1">Chef's Secret Tip</label>
        <input
          id="rem-cheftip"
          type="text"
          bind:value={chefTip}
          placeholder="e.g. Searing on smoking hot pan locks in moisture and creates craggy golden edges."
          class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2.5 text-xs text-[#0B1F2E] outline-none"
        />
      </div>

      <!-- Thumbnail Selection / Presets -->
      <div>
        <label for="rem-thumb" class="block text-xs font-bold text-[#0B1F2E] mb-1.5">Recipe Photography</label>
        <div class="flex flex-wrap gap-2 mb-2">
          {#each recipeThumbPresets as preset}
            <button
              type="button"
              onclick={() => (thumbnail = preset.url)}
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all {thumbnail === preset.url ? 'border-[#2B5A16] bg-[#EBF7DC] text-[#2B5A16] font-bold' : 'border-[#E4E4DC] text-[#4A5A52] hover:bg-slate-50'}"
            >
              <img src={preset.url} alt={preset.label} class="h-4 w-4 rounded-full object-cover" />
              <span>{preset.label}</span>
            </button>
          {/each}
        </div>
        <input
          id="rem-thumb"
          type="text"
          bind:value={thumbnail}
          placeholder="/images/recipe-example.jpg or https://..."
          class="w-full rounded-xl border border-[#D5E2C4] px-3.5 py-2 text-xs text-[#0B1F2E] outline-none font-mono text-[11px]"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-[#E4E4DC]">
        <button
          type="button"
          onclick={onClose}
          class="rounded-xl border border-[#D5E2C4] px-4 py-2.5 text-xs font-bold text-[#4A5A52] hover:bg-[#F5F5F0] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          class="rounded-xl bg-[#2B5A16] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#1f4210] active:scale-98 transition-all cursor-pointer disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : (isEditing ? 'Save Recipe Changes' : 'Publish Recipe to Hub')}
        </button>
      </div>
    </form>
  </div>
</div>

