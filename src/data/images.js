/**
 * Central image configuration
 * High-end authentic food photoshoot assets for Only Superfoods.
 */

export const images = {
  // ─── Hero & Section Banners ──────────────────────────────────
  heroSpread: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/hero%20.webp',
  bannerOyster: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/oyster%20banner.webp',
  bannerMicrogreens: '/images/banner-microgreens.jpg',
  bannerKombucha: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp',

  // ─── Products ────────────────────────────────────────────────
  prodGreyOyster: '/images/prod-grey-oyster.jpg',
  prodPinkOyster: '/images/prod-pink-oyster.jpg',
  prodMixedOyster: '/images/prod-mixed-oyster.jpg',
  prodMicrogreensMix: '/images/prod-microgreens-mix.jpg',
  prodKombucha: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp',
  prodDesiEggs: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp',

  // ─── Category Circle Avatars ─────────────────────────────────
  catMushrooms: '/images/prod-grey-oyster.jpg',
  catMicrogreens: '/images/prod-microgreens-mix.jpg',
  catKombucha: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/Vibrant%20Kombucha%20Collection%20with%20Fresh%20Garnishes.webp',
  catEggs: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp',
  catProduce: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/hero%20.webp',

  // ─── Story Section ───────────────────────────────────────────
  storyGrowing: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/oyster%20banner.webp',
  storyHarvest: '/images/banner-microgreens.jpg',
  storyDelivery: 'https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/From%20Farm%20to%20Kitchen%20in%20Hours.webp',
};

export const heroImage = images.heroSpread;

export const storyImages = {
  growing: images.storyGrowing,
  harvest: images.storyHarvest,
  delivery: images.storyDelivery,
};

export function getImage(key) {
  return images[key] ?? images.heroSpread;
}
