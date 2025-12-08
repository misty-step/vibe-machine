/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        void: '#030304',
        carbon: '#0a0a0b',
        plasma: '#ffb703',
        flux: '#0ea5e9',
        'white-5': 'rgba(255,255,255,0.05)',
        'white-10': 'rgba(255,255,255,0.10)',
      },
      fontFamily: {
        sans: ['Geist Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Geist Sans', 'sans-serif'],
      },
      backgroundImage: {
        'noise': "none", 
        'grid-pattern': "linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      boxShadow: {
        'glow': '0 0 20px -5px var(--tw-shadow-color)',
        'inner-light': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
      }
    },
  },
  plugins: [],
}
