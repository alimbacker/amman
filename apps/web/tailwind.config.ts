import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: '#6B0F1A', 50: '#FBEFEF', 100: '#F3D6D8', 700: '#5A0C16', 800: '#480912', 900: '#33060C' },
        crimson: { DEFAULT: '#9E1B1B', 600: '#8B1717' },
        gold: { DEFAULT: '#C9962B', light: '#E8C468', pale: '#F7E7BE', dark: '#9A7020' },
        cream: { DEFAULT: '#FFF8EC', deep: '#FBEFD9' },
        saffron: { DEFAULT: '#F08A24', light: '#FCD9B0', pale: '#FFF1E0' },
        ink: { DEFAULT: '#2B1A14', soft: '#5C4A40', mute: '#8A776B' },
      },
      fontFamily: {
        display: ['"Noto Serif Tamil"', 'Georgia', 'serif'],
        body: ['"Mukta Malar"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(107,15,26,.06), 0 8px 24px -12px rgba(107,15,26,.18)',
        lift: '0 2px 4px rgba(107,15,26,.08), 0 18px 40px -16px rgba(107,15,26,.35)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
