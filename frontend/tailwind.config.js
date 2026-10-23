/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors - Deep Maroon primary, Warm Gold accent
        brand: {
          50: '#FDFBF7',   // Soft background
          100: '#F7EEDD',  // Light background tint (gold tint)
          200: '#E2C475',  // Border gold
          300: '#D4AF37',  // Warm Gold / Champagne (brand-gold)
          400: '#C49A2E',
          500: '#B38626',
          600: '#8B2940',  // Light/Tints of primary
          700: '#6B1D2F',  // Primary (Deep Maroon) - main brand color
          800: '#531322',  // Hover/Dark
          900: '#3D0D18',
          950: '#2D151B',  // Headings/Body dark (Neutral/Text)
        },
        gold: {
          50: '#FDFBF7',
          100: '#F7EEDD',
          200: '#E2C475',
          300: '#D4AF37',  // Main gold
          400: '#C49A2E',
          500: '#B38626',
          600: '#9A6F20',
          700: '#81591A',
          800: '#694417',
          900: '#553814',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Hind Siliguri', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        bengali: ['Hind Siliguri', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

module.exports = config;