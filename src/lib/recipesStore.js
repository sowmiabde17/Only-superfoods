/**
 * src/lib/recipesStore.js
 * Central Reactive Store for Dynamic Recipe Catalog Management.
 * Supports Full CRUD: Add, Edit, Delete, and Reset.
 * Synchronizes across Astro Svelte islands via CustomEvent ('osf:recipes-updated')
 * and persists to browser localStorage ('osf_recipes_catalog').
 */

import { recipes as defaultRecipes, recipeCategories as defaultCategories } from '../data/recipes.js';
import { supabase } from './supabase.js';
import { callAdminApi } from './adminAuth.js';

const STORAGE_KEY = 'osf_recipes_catalog';
let hasSynced = false;

function parseJsonField(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
      return fallback;
    }
  }
  return fallback;
}

/**
 * Sync recipes from Supabase in the background
 */
export async function syncRecipesFromSupabase() {
  if (typeof window === 'undefined') return;
  try {
    const { data, error } = await supabase.from('recipes').select('*');
    if (error || !data || data.length === 0) return;

    const formatted = data.map((r) => {
      const seed = defaultRecipes.find((d) => d.id === r.id || d.slug === r.slug) || {};
      const parsedIngredients = parseJsonField(r.ingredients, seed.ingredientsList || []);
      const parsedSteps = parseJsonField(r.instructions, seed.steps || []);
      const parsedTags = parseJsonField(r.tags, seed.tags || []);
      const parsedPairings = parseJsonField(r.pairings, seed.pairings || []);

      return {
        ...seed,
        id: r.id,
        title: r.title || seed.title,
        slug: r.slug || seed.slug,
        category: r.category || seed.category,
        subtitle: r.short_description || seed.subtitle,
        thumbnail: r.image_url || seed.thumbnail,
        prepTime: r.prep_time || seed.prepTime,
        cookTime: r.cook_time || seed.cookTime,
        servings: Number(r.servings) || seed.servings || 2,
        difficulty: r.difficulty || seed.difficulty || 'Easy',
        tags: parsedTags,
        ingredientsList: parsedIngredients,
        steps: parsedSteps,
        chefTip: r.chef_tip || seed.chefTip,
        pairings: parsedPairings,
      };
    });

    saveRecipes(formatted);
  } catch (err) {
    console.error('Failed to sync recipes from Supabase:', err);
  }
}

/**
 * Get current recipes from localStorage (falls back to seed data)
 * @returns {Array<object>}
 */
export function getRecipes() {
  if (typeof window === 'undefined') return defaultRecipes;
  if (!hasSynced) {
    hasSynced = true;
    syncRecipesFromSupabase();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRecipes));
      return defaultRecipes;
    }
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0]?.steps !== 'string' &&
      typeof parsed[0]?.ingredientsList !== 'string'
    ) {
      return parsed;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultRecipes));
    return defaultRecipes;
  } catch (err) {
    console.error('Failed to read recipes catalog from localStorage:', err);
    return defaultRecipes;
  }
}

/**
 * Save recipes to localStorage and dispatch update event
 * @param {Array<object>} items
 */
function saveRecipes(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(
      new CustomEvent('osf:recipes-updated', { detail: { recipes: items } })
    );
  } catch (err) {
    console.error('Failed to save recipes to localStorage:', err);
  }
}

/**
 * Get a single recipe by its slug
 * @param {string} slug
 * @returns {object|null}
 */
export function getRecipeBySlug(slug) {
  const all = getRecipes();
  return all.find((r) => r.slug === slug || r.id === slug) || null;
}

/**
 * Add a new recipe to the collection
 * @param {object} recipeData
 * @returns {object} The created recipe
 */
export async function addRecipe(recipeData) {
  const all = getRecipes();
  const slug = (recipeData.slug || recipeData.title || 'recipe')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const id = slug;

  const newRecipe = {
    id,
    title: recipeData.title.trim(),
    slug,
    category: recipeData.category || 'Mushrooms',
    subtitle:
      recipeData.subtitle ||
      `A delicious farm-to-table recipe featuring freshly harvested ${recipeData.product || 'produce'}.`,
    product: recipeData.product || 'Grey Oyster Mushrooms',
    productId: recipeData.productId || 'grey-oyster',
    productPackPrice: Number(recipeData.productPackPrice) || 100,
    productPackSize: recipeData.productPackSize || '250 g',
    thumbnail: recipeData.thumbnail || '/images/recipe-garlic-butter-mushrooms.jpg',
    videoDuration: recipeData.videoDuration || '5 min',
    prepBadge: `${recipeData.prepTime || '5 min'} prep`,
    badgeNote: `${recipeData.prepTime || '5 min'} prep`,
    handwrittenBadge: recipeData.title.split(' ').slice(0, 3).join('\n'),
    prepTime: recipeData.prepTime || '10 min',
    cookTime: recipeData.cookTime || '15 min',
    servings: Number(recipeData.servings) || 2,
    difficulty: recipeData.difficulty || 'Easy',
    isPopular: Boolean(recipeData.isPopular),
    nutrientHighlights: recipeData.nutrientHighlights || [
      'High protein',
      'Low calorie',
      'Rich in B vitamins',
      'Immunity booster',
    ],
    ingredientsList: recipeData.ingredientsList || [
      { name: 'fresh oyster mushrooms', baseQty: 200, unit: 'g' },
      { name: 'pure A2 ghee or butter', baseQty: 2, unit: 'tbsp' },
      { name: 'garlic cloves, minced', baseQty: 4, unit: '' },
      { name: 'Salt & pepper to taste', baseQty: null, unit: '' },
    ],
    ingredients: recipeData.ingredients || [
      '200g fresh farm harvest mushrooms',
      '2 tbsp pure butter or ghee',
      '4 cloves garlic, thinly sliced',
      'Salt and freshly cracked black pepper to taste',
    ],
    steps: recipeData.steps && recipeData.steps.length > 0
      ? recipeData.steps
      : [
          'Tear mushrooms along the grain into bite-sized pieces for maximum crispy edges.',
          'Heat a wide skillet until smoking hot, add butter and sear mushrooms undisturbed for 3 minutes.',
          'Flip, toss with sliced garlic and seasonings, and serve sizzling hot straight from the pan!',
        ],
    nutritionFacts: recipeData.nutritionFacts || [
      { label: 'Calories', value: '160 kcal' },
      { label: 'Protein', value: '4.5 g' },
      { label: 'Dietary Fiber', value: '2.8 g' },
    ],
    chefNotes: recipeData.chefNotes || [
      'High heat is essential to sear immediately without drawing out excess moisture.',
      'Always tear rather than knife-cut mushrooms to preserve natural cell structure and craggy texture.',
    ],
    isEvergreen: true,
  };

  try {
    await callAdminApi('upsert_recipe', { recipe: newRecipe });
    all.unshift(newRecipe);
    saveRecipes(all);
    return { success: true, recipe: newRecipe };
  } catch (err) {
    console.error('[RecipesStore] addRecipe failed:', err);
    return { success: false, error: err?.message || 'Failed to save recipe to Supabase.' };
  }
}

/**
 * Update an existing recipe
 * @param {string} slug
 * @param {object} updates
 */
export async function updateRecipe(slug, updates) {
  const all = getRecipes();
  const index = all.findIndex((r) => r.slug === slug || r.id === slug);
  if (index === -1) return { success: false, error: 'Recipe not found.' };

  const existing = all[index];
  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    slug: existing.slug,
  };

  try {
    await callAdminApi('upsert_recipe', { recipe: updated });
    all[index] = updated;
    saveRecipes(all);
    return { success: true, recipe: updated };
  } catch (err) {
    console.error('[RecipesStore] updateRecipe failed:', err);
    return { success: false, error: err?.message || 'Failed to update recipe in Supabase.' };
  }
}

/**
 * Delete a recipe
 * @param {string} slug
 */
export async function deleteRecipe(slug) {
  const all = getRecipes();
  const filtered = all.filter((r) => r.slug !== slug && r.id !== slug);
  if (filtered.length === all.length) return { success: false, error: 'Recipe not found.' };

  try {
    await callAdminApi('delete_recipe', { id: slug });
    saveRecipes(filtered);
    return { success: true };
  } catch (err) {
    console.error('[RecipesStore] deleteRecipe failed:', err);
    return { success: false, error: err?.message || 'Failed to delete recipe from Supabase.' };
  }
}

/**
 * Reset recipes back to default seed data
 */
export async function resetToDefaultRecipes() {
  if (typeof window === 'undefined') return { success: false, error: 'Browser required' };
  try {
    for (const r of defaultRecipes) {
      await callAdminApi('upsert_recipe', { recipe: r });
    }
    saveRecipes(defaultRecipes);
    return { success: true };
  } catch (err) {
    console.error('[RecipesStore] resetToDefaultRecipes failed:', err);
    return { success: false, error: err?.message || 'Failed to reset recipes.' };
  }
}

