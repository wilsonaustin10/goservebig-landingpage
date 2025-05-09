/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0eb9c6', // Teal
        secondary: '#f76547', // Orange-red
        accent: '#f76547', // Orange-red
        highlight: '#0eb9c6', // Teal for consistent highlighting
        background: '#ffffff', // White
        text: '#333333', // Dark gray for regular text
        footer: {
          bg: '#0eb9c6', // Teal
          text: '#ffffff', // White
          hover: '#f76547', // Orange-red
        }
      },
    },
  },
  plugins: [],
}; 