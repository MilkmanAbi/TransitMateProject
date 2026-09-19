import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef6ff', 300: '#93c5fd', 400: '#60a5fa', 500: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a' },
        alert: { critical: '#dc2626', warning: '#d97706', info: '#0891b2', ok: '#059669' },
        surface: { DEFAULT: '#0b1220', raised: '#0f172a', card: '#1e293b', border: '#334155', muted: '#94a3b8' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { rise: 'rise .35s ease-out both' },
    },
  },
  plugins: [],
} satisfies Config;
