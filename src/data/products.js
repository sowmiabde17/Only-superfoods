/**
 * Product Catalogue
 * Driven by the farm-fresh design spec & actual photoshoot assets.
 * Enriched with storage instructions, shelf life, culinary tips, and recipe pairings.
 */

export const products = [
  // ─── 1. Grey Oyster Mushrooms ────────────────────────────────
  {
    id: "grey-oyster",
    name: "Grey Oyster Mushrooms",
    slug: "grey-oyster-mushrooms",
    category: "Mushrooms",
    badge: "Bestseller",
    badgeType: "orange",
    shortDescription: "Tender, meaty, velvety caps harvested same morning in Kadugodi.",
    longDescription:
      "Grown in humidity-controlled fruiting rooms with zero chemical pesticides. Harvested early morning at peak tenderness with moisture intact. Unbeatable texture that pan-sears golden in minutes.",
    price: 100,
    unit: "250 g",
    packSizes: [
      { size: "250 g", price: 100 },
      { size: "500 g", price: 180 },
      { size: "1 kg", price: 340 },
    ],
    freshnessBadge: "Harvested today at 5:30 AM",
    shelfLife: "5 to 7 days in refrigerator",
    storageGuide:
      "Keep unwashed in the breathable kraft paper punnet in the vegetable crisper drawer (4°C – 7°C). Do not seal in airtight plastic. Wash or wipe gently only right before cooking.",
    culinaryTips:
      "Sear in a hot pan with olive oil or butter for 3-4 minutes until golden edges develop. Do not overcrowd the pan. Add salt towards the end to avoid drawing out water prematurely.",
    recipePairings: [
      { slug: "garlic-butter-oyster-mushrooms", title: "Garlic Butter Oyster Mushrooms" },
      { slug: "creamy-mushroom-pasta", title: "Creamy Mushroom Pasta" },
      { slug: "mushroom-fried-rice", title: "Mushroom Fried Rice" },
    ],
    minOrder: 1,
    image: "/images/prod-grey-oyster.jpg",
    nutritionFacts: [
      { label: "Protein", value: "3.3g / 100g" },
      { label: "Iron", value: "1.3mg / 100g" },
      { label: "Fibre", value: "2.3g / 100g" },
      { label: "B Vitamins", value: "B1, B2, B3, B5" },
    ],
    whatsappMessage:
      "Hi! I'd like to order Grey Oyster Mushrooms ({{size}}). Please confirm availability and delivery slot! 🍄",
  },

  // ─── 2. Pink Oyster Mushrooms ────────────────────────────────
  {
    id: "pink-oyster",
    name: "Pink Oyster Mushrooms",
    slug: "pink-oyster-mushrooms",
    category: "Mushrooms",
    badge: "Fresh Harvest",
    badgeType: "green",
    shortDescription: "Vibrant rose-pink ruffled caps with a delicate, nutty aroma.",
    longDescription:
      "A tropical gourmet delicacy (Pleurotus djamor). Striking coral-pink clusters that cook fast with a subtle woody crunch. Packed fresh in breathable kraft punnets.",
    price: 120,
    unit: "250 g",
    packSizes: [
      { size: "250 g", price: 120 },
      { size: "500 g", price: 230 },
    ],
    freshnessBadge: "Harvested at dawn",
    shelfLife: "4 to 5 days in refrigerator",
    storageGuide:
      "Pink oysters are naturally delicate. Store in their breathable punnet in the coldest part of your fridge. Use within 4 days for peak fragrance and coral color.",
    culinaryTips:
      "Flash-sear in smoking-hot ghee or coconut oil for 2 minutes. Outstanding in Thai curries, pan-seared tacos, and pasta garnishes.",
    recipePairings: [
      { slug: "stir-fry-mushrooms-veggies", title: "Stir-fry Mushrooms & Veggies" },
      { slug: "creamy-mushroom-pasta", title: "Creamy Mushroom Pasta" },
    ],
    minOrder: 1,
    image: "/images/prod-pink-oyster.jpg",
    nutritionFacts: [
      { label: "Antioxidants", value: "High Ergothioneine" },
      { label: "B Vitamins", value: "B1, B2, B3" },
      { label: "Potassium", value: "420mg / 100g" },
    ],
    whatsappMessage:
      "Hi! I'd like to order Pink Oyster Mushrooms ({{size}}). Please confirm delivery! 🌸🍄",
  },

  // ─── 3. Mixed Oyster Mushrooms ───────────────────────────────
  {
    id: "mixed-oyster",
    name: "Mixed Oyster Mushrooms",
    slug: "mixed-oyster-mushrooms",
    category: "Mushrooms",
    badge: "Chef's Pick",
    badgeType: "orange",
    shortDescription: "Gourmet medley of Grey, Pink, and Golden Oyster clusters.",
    longDescription:
      "The chef's favourite. An assorted harvest bowl combining pearl grey, coral pink, and canary yellow oysters. Beautiful on the plate and incredible in risottos or stir-fries.",
    price: 120,
    unit: "250 g",
    packSizes: [
      { size: "250 g", price: 120 },
      { size: "500 g", price: 230 },
    ],
    freshnessBadge: "Handpicked harvest medley",
    shelfLife: "5 to 6 days in refrigerator",
    storageGuide:
      "Keep refrigerated in the kraft container. Avoid moisture accumulation by keeping away from freezer vents.",
    culinaryTips:
      "Roast on a parchment-lined baking sheet at 200°C for 12 minutes with sea salt, thyme, and crushed garlic. Produces irresistible crispy edges.",
    recipePairings: [
      { slug: "mushroom-soup", title: "Velvety Mushroom Soup" },
      { slug: "garlic-butter-oyster-mushrooms", title: "Garlic Butter Mushrooms" },
    ],
    minOrder: 1,
    image: "/images/prod-mixed-oyster.jpg",
    nutritionFacts: [
      { label: "Protein", value: "3.5g / 100g" },
      { label: "Trace Minerals", value: "Zinc & Potassium" },
      { label: "Prebiotic Fibre", value: "Beta-glucans" },
    ],
    whatsappMessage:
      "Hi! I'd love to order the Mixed Oyster Mushroom Box ({{size}}). 🍄🌈",
  },

  // ─── 4. Sunflower Microgreens ────────────────────────────────
  {
    id: "sunflower-microgreens",
    name: "Sunflower Microgreens",
    slug: "sunflower-microgreens",
    category: "Microgreens",
    badge: "Living Greens",
    badgeType: "green",
    shortDescription: "Nutty sunflower shoots & vibrant radish sprouts. 40x nutrient density.",
    longDescription:
      "Lush organic microgreens clipped on order morning. Crunchy nutty sunflower shoots paired with spicy purple radish for a peppery vitamin kick.",
    price: 80,
    unit: "50 g",
    packSizes: [
      { size: "50 g", price: 80 },
      { size: "100 g", price: 150 },
    ],
    freshnessBadge: "Clipped this morning",
    shelfLife: "7 to 10 days in refrigerator",
    storageGuide:
      "Store between paper towels in a sealed container in your fridge. Keep dry. They stay super crunchy for over a week.",
    culinaryTips:
      "Eat raw! Toss into warm omelettes, avocado toast, grain bowls, and sandwich wraps right before serving to preserve live enzymes and crisp crunch.",
    recipePairings: [
      { slug: "egg-bhurji-with-microgreens", title: "Egg Bhurji with Microgreens" },
      { slug: "microgreen-salad-bowl", title: "Fresh Microgreen Salad Bowl" },
    ],
    minOrder: 1,
    image: "/images/prod-microgreens-mix.jpg",
    nutritionFacts: [
      { label: "Vitamin C", value: "6x mature greens" },
      { label: "Sulforaphane", value: "Extremely high" },
      { label: "Chlorophyll", value: "High bio-active" },
    ],
    whatsappMessage:
      "Hi! I'd like to order Sunflower Microgreens ({{size}}). 🌱",
  },

  // ─── 5. Kombucha (Original) ──────────────────────────────────
  {
    id: "kombucha-original",
    name: "Artisanal Raw Kombucha",
    slug: "kombucha-original",
    category: "Kombucha",
    badge: "Gut Health",
    badgeType: "orange",
    shortDescription: "Naturally sparkling, raw unpasteurized probiotic tea elixir.",
    longDescription:
      "Slow-fermented for 21 days with whole leaf Assam black tea and organic green tea. Packed with live probiotic cultures, organic acids, and clean fizziness with low sugar.",
    price: 120,
    unit: "250 ml",
    packSizes: [
      { size: "250 ml", price: 120 },
      { size: "500 ml", price: 220 },
    ],
    freshnessBadge: "Active living probiotics",
    shelfLife: "60 days (always refrigerated)",
    storageGuide:
      "Must be kept cold (2°C – 6°C) at all times to pause fermentation. Do not shake the bottle before opening.",
    culinaryTips:
      "Enjoy chilled 30 minutes before or after lunch as a digestive tonic. Or mix with fresh mint and pomegranate for a gut-healthy mocktail.",
    recipePairings: [
      { slug: "kombucha-fruit-fizz-mocktail", title: "Kombucha Fruit Fizz Mocktail" },
    ],
    minOrder: 1,
    image: "/images/prod-kombucha-bottle.jpg",
    nutritionFacts: [
      { label: "Probiotics", value: "1 Billion+ CFUs" },
      { label: "Acetic Acid", value: "Natural detoxifier" },
      { label: "Sugar", value: "< 3.2g / 100ml" },
    ],
    whatsappMessage:
      "Hi! I'd like to order Raw Kombucha ({{size}}). 🍾✨",
  },

  // ─── 6. Desi Eggs (Free Range) ───────────────────────────────
  {
    id: "desi-eggs",
    name: "Free-Range Desi Eggs",
    slug: "desi-eggs",
    category: "Desi Eggs",
    badge: "Farm Fresh",
    badgeType: "green",
    shortDescription: "Rich golden yolks from pasture-roaming, grain-fed country hens.",
    longDescription:
      "Authentic desi country eggs from hens that forage freely in open outdoor sunshine. Deep amber yolks rich in natural Omega-3, choline, and clean bioavailable protein.",
    price: 90,
    unit: "6 pcs",
    packSizes: [
      { size: "6 pcs", price: 90 },
      { size: "12 pcs", price: 170 },
      { size: "30 pcs (Tray)", price: 410 },
    ],
    freshnessBadge: "Collected daily at farm",
    shelfLife: "21 days refrigerated, 10 days room temp",
    storageGuide:
      "Store pointy-end down in the egg carton in your refrigerator. Keep away from strong-smelling foods as eggshells are porous.",
    culinaryTips:
      "The rich yolk makes incredible sunny-side-up eggs, soft-boiled ramen eggs, and velvety scramble. Cook over gentle medium-low heat.",
    recipePairings: [
      { slug: "egg-bhurji-with-microgreens", title: "Egg Bhurji with Microgreens" },
    ],
    minOrder: 1,
    image: "https://ufewlbjqtxpumwlwkunn.supabase.co/storage/v1/object/public/media/banners/ehggs.webp",
    nutritionFacts: [
      { label: "Protein", value: "6.5g / egg" },
      { label: "Omega-3", value: "High natural content" },
      { label: "Choline", value: "Essential brain nutrient" },
    ],
    whatsappMessage:
      "Hi! I'd like to order Free-Range Desi Eggs ({{size}}). 🥚🌿",
  },
];
