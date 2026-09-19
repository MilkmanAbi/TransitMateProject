import type { Config } from 'tailwindcss';

// PaperDesign theme (github.com/MilkmanAbi/PaperDesign, by Abinaash / MilkmanAbi): one warm undertone, four
// neutral steps, one muted ink-blue accent, duller semantic companions, two radii (4px boxes, pills for bars).
// The neutral and semantic scales are remapped for a light paper surface: low steps are the dark "ink" tones
// used for text, mid steps are muted fills.
const ink = { 50: '#1a1712', 100: '#221e18', 200: '#2e2a23', 300: '#403a31', 400: '#554e43', 500: '#6b6458', 600: '#a39b8d', 700: '#cfc7b8', 800: '#e3dccf', 900: '#ece6da', 950: '#f4f0e8' };
const muted = (dark: string, mid: string, fill: string, deep: string) => ({ 50: dark, 100: dark, 200: dark, 300: dark, 400: mid, 500: fill, 600: deep, 700: deep, 800: deep, 900: deep, 950: deep });

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    borderRadius: { none: '0', sm: '2px', DEFAULT: '4px', md: '4px', lg: '4px', xl: '4px', '2xl': '4px', '3xl': '4px', full: '9999px' },
    boxShadow: {
      none: 'none',
      sm: '0 1px 2px rgba(28,26,22,0.08), 0 1px 1px rgba(28,26,22,0.04)',
      DEFAULT: '0 1px 2px rgba(28,26,22,0.08), 0 1px 1px rgba(28,26,22,0.04)',
      md: '0 1px 2px rgba(28,26,22,0.08), 0 1px 1px rgba(28,26,22,0.04)',
      lg: '0 1px 2px rgba(28,26,22,0.08), 0 1px 1px rgba(28,26,22,0.04)',
      xl: '0 8px 24px rgba(28,26,22,0.14)',
      '2xl': '0 8px 24px rgba(28,26,22,0.14)',
    },
    extend: {
      colors: {
        white: '#1f1c17',
        black: '#1f1c17',
        paper: '#f7f3ea',
        sunken: '#e6dfd1',
        slate: ink,
        brand: { 50: '#1f3450', 300: '#2c4a6e', 400: '#2f5178', 500: '#3a5f8a', 700: '#2c4a6e', 900: '#1f3450' },
        red: muted('#8a3224', '#973a2b', '#a3473a', '#8f3426'),
        amber: muted('#74501a', '#8a6120', '#b08236', '#8a6120'),
        yellow: muted('#6f5a16', '#806a1c', '#a98e36', '#806a1c'),
        emerald: muted('#35583d', '#3f6b4c', '#5a8666', '#3f6b4c'),
        green: muted('#35583d', '#3f6b4c', '#5a8666', '#3f6b4c'),
        cyan: muted('#265a63', '#2c6a74', '#4a8a93', '#2c6a74'),
        sky: muted('#2a5573', '#2f5f80', '#4f7ea0', '#2f5f80'),
        blue: muted('#2c4a6e', '#2f5178', '#4a6f9a', '#2f5178'),
        violet: muted('#4e3d6b', '#5a4a78', '#6b5a88', '#4e3d6b'),
        pink: muted('#7a3552', '#8a3d5e', '#a0536f', '#8a3d5e'),
        alert: { critical: '#8f3426', warning: '#8a6120', info: '#2c6a74', ok: '#3f6b4c' },
        surface: { DEFAULT: '#f1ece2', raised: '#faf7f1', card: '#faf7f1', border: '#d6cfc1', muted: '#6b6458' },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
        mono: ['ui-monospace', '"SF Mono"', '"Cascadia Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        rise: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { rise: 'rise .16s ease-out both' },
    },
  },
  plugins: [],
} satisfies Config;
