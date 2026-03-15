/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#8b5cf6',
        'primary-300': '#d8b4fe',
        'primary-500': '#8b5cf6',
        surface: {
          950: '#0e0e12',
          900: '#14141a',
          800: '#23232e',
          700: '#37374a',
        },
      },
    },
  },
  plugins: [],
};
