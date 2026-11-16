/**
 * Site-wide brand configuration
 * Central source of truth for contact info, social links, and meta tags.
 */

export const site = {
  name: 'Only Superfoods',
  domain: 'onlysuperfoods.in',
  url: 'https://onlysuperfoods.in',
  tagline: 'Better Food. Better Living.',
  description:
    'Farm-fresh oyster mushrooms, microgreens, kombucha & desi eggs — delivered same-day in Bangalore.',

  /** Contact & social */
  whatsapp: {
    number: '7019760360',
    /** Full international format for wa.me links */
    link: 'https://wa.me/917019760360',
  },
  instagram: {
    handle: '@the_paradise_mushrooms',
    url: 'https://www.instagram.com/the_paradise_mushrooms',
  },

  /** Physical address */
  address: {
    area: 'Whitefield (Kadugodi)',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560067',
    full: 'Whitefield (Kadugodi), Bangalore, Karnataka 560067',
  },

  /** Brand colours (mirrored in global.css @theme) */
  colors: {
    brandGreen: '#A8D632',
    deepGreen: '#2B5A16',
    ink: '#0B1F2E',
    body: '#4A5A52',
    card: '#F7F7F2',
    border: '#E4E4DC',
    orangeStart: '#FF8A00',
    orangeEnd: '#E2311A',
  },

  /**
   * Open Graph & meta — optimised for WhatsApp and Instagram link previews.
   * WhatsApp uses og:title, og:description, og:image.
   * Instagram in-app browser uses the same OG tags.
   */
  ogTitle: 'Only Superfoods — Farm-Fresh Mushrooms, Microgreens & More',
  ogDescription:
    'Harvested today, delivered today. Grey oyster mushrooms, microgreens, raw kombucha & free-range desi eggs in Bangalore.',
  /** 1200x630 compressed OpenGraph social preview image */
  ogImage: '/og-share.jpg',
  ogType: 'website',
  ogLocale: 'en_IN',
};
