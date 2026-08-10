/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { syne: ['Syne', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      colors: {
        primary: { DEFAULT: '#059669', dark: '#047857', light: '#D1FAE5' },
        danger: { DEFAULT: '#EF4444', light: '#FEE2E2' },
        warn: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
      },
    },
  },
  plugins: [],
}
