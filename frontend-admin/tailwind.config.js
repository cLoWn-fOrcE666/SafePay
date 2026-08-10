/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { syne: ['Syne', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
      colors: {
        primary: { DEFAULT: '#1D4ED8', dark: '#1E40AF', light: '#DBEAFE' },
        danger: { DEFAULT: '#EF4444', light: '#FEE2E2' },
        warn: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
        success: { DEFAULT: '#10B981', light: '#D1FAE5' },
      },
    },
  },
  plugins: [],
}
