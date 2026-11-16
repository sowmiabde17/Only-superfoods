/**
 * Customer reviews
 * Kept casual and realistic — these read like actual WhatsApp messages
 * and Google reviews, not polished marketing copy.
 */

export const reviews = [
  {
    id: 'review-01',
    name: 'Priya Sharma',
    rating: 5,
    text: 'These mushrooms are insanely fresh, my kids actually ate them without complaining 😂 Made garlic butter mushrooms and they were gone in 5 mins flat.',
    product: 'Grey Oyster Mushrooms',
    date: '2024-11-12',
  },
  {
    id: 'review-02',
    name: 'Arjun Nair',
    rating: 5,
    text: 'The kombucha is addictive honestly, I\'ve been ordering every week now. The ginger lemon one is 🔥. Way better than the store bought stuff.',
    product: 'Kombucha',
    date: '2024-11-08',
  },
  {
    id: 'review-03',
    name: 'Sneha Reddy',
    rating: 4,
    text: 'Tried the microgreens for the first time. Was skeptical but they actually taste amazing in smoothies. Radish ones have a nice kick!',
    product: 'Microgreens Mix',
    date: '2024-10-25',
  },
  {
    id: 'review-04',
    name: 'Rahul Menon',
    rating: 5,
    text: 'Bro the egg yolks are SO orange. Like actually orange not that pale yellow nonsense from bigbasket. My omelettes have never looked better lol',
    product: 'Desi Eggs',
    date: '2024-10-19',
  },
  {
    id: 'review-05',
    name: 'Deepa Krishnan',
    rating: 5,
    text: 'Made mushroom biryani with these oyster mushrooms and even my husband (who only eats chicken biryani) asked for seconds. That says everything 😄',
    product: 'Grey Oyster Mushrooms',
    date: '2024-10-14',
  },
  {
    id: 'review-06',
    name: 'Vikram Joshi',
    rating: 4,
    text: 'Good quality eggs, you can clearly tell the difference from regular ones. Slightly pricey but worth it if you care about what you\'re eating. Will reorder.',
    product: 'Desi Eggs',
    date: '2024-09-30',
  },
  {
    id: 'review-07',
    name: 'Ananya Iyer',
    rating: 5,
    text: 'I put microgreens on literally everything now.. eggs, sandwiches, even maggi 😅 The freshness is unreal, they deliver same morning. Super impressed with the quality!',
    product: 'Microgreens Mix',
    date: '2024-09-22',
  },
  {
    id: 'review-08',
    name: 'Karthik Rao',
    rating: 4,
    text: 'Started drinking kombucha for gut health and I genuinely feel a difference. Took a week to get used to the taste but now I crave it. Wish they had bigger bottles tho!',
    product: 'Kombucha',
    date: '2024-09-15',
  },
];

/** Get reviews for a specific product */
export function getReviewsByProduct(productName) {
  return reviews.filter((r) => r.product === productName);
}

/** Average rating across all reviews */
export function getAverageRating() {
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return (total / reviews.length).toFixed(1);
}
