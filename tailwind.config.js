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
        primary: '#1A4B8C', // Navy blue
        secondary: '#E41F2D', // Red
        accent: '#E41F2D', // Red
        highlight: '#1A4B8C', // Navy blue for consistent highlighting
        background: '#ffffff', // White
        text: '#333333', // Dark gray for regular text
        footer: {
          bg: '#1A4B8C', // Navy blue
          text: '#ffffff', // White
          hover: '#E41F2D', // Red
        }
      },
    },
  },
  plugins: [],
}; 