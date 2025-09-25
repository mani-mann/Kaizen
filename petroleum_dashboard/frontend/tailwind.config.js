/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#28a745',
        accent: '#6fda8f',
        surface: '#ffffff',
        border: '#e5e7eb'
      }
    },
  },
  plugins: [],
};

