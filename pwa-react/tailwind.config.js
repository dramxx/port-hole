/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#1a1a1a',
          secondary: '#2d2d2d',
          tertiary: '#404040',
          border: '#404040',
          text: '#ffffff',
          muted: '#9ca3af'
        },
        purple: {
          DEFAULT: '#8b5cf6',
          light: '#a78bfa',
          dark: '#7c3aed',
          accent: '#8b5cf6'
        }
      }
    },
  },
  plugins: [],
}
