/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'brand-green': '#A8D632',
        'deep-green': '#2B5A16',
        'ink': '#0B1F2E',
        'body': '#4A5A52',
        'card': '#F7F7F2',
        'border': '#E4E4DC',
        'orange-start': '#FF8A00',
        'orange-end': '#E2311A',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        DEFAULT: '3px',
        xs: '2px',
        sm: '2px',
        md: '4px',
      },
      boxShadow: {
        '2xs': '0 1px 2px 0 rgb(0 0 0 / 0.03)',
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      backdropBlur: {
        xs: '2px',
      },
      scale: {
        '96': '0.96',
        '98': '0.98',
      },
      padding: {
        '0.2': '1px',
      },
    },
  },
  plugins: [],
};

