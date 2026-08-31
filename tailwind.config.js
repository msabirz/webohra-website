/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // lib/button-styles.ts (and any other lib helper that builds className
    // strings, e.g. lib/category-icon.tsx) constructs Tailwind classes from
    // template strings — without scanning lib/ too, any utility that only
    // ever appears inside those template strings (like `inline-flex` in
    // buttonStyles' BASE constant) never gets generated into the compiled
    // CSS at all, silently breaking every button built from it.
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1B3A6B', deep: '#12294D' },
        gold: { DEFAULT: '#B08D3F', soft: '#D9BE84' },
        teal: { DEFAULT: '#1F5C55', deep: '#153F3A' },
        ivory: { DEFAULT: '#F7F1E6', deep: '#EFE4CE' },
        ink: { DEFAULT: '#2A1D16', soft: '#5C4C3F' },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'Fraunces', 'serif'],
        body: ['var(--font-body)', 'Karla', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
