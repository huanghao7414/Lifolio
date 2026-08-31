import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#FF4500',
        'brand-light': '#FF6B3D',
        'brand-dim': '#FF450020',
        surface: '#F8F8F8',
        'ai-bg': '#FFF8F5',
        'ai-border': '#FFD4C2',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
