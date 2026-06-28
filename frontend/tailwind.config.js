/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        triki: {
          DEFAULT: '#d32f2f',
          50: '#fff5f5',
          100: '#feecec',
          200: '#f6d3d3',
          300: '#ef9a9a',
          400: '#e57373',
          500: '#d32f2f',
          600: '#b71c1c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial']
      }
    },
  },
  plugins: [],
}