/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Arial"]
      },
      boxShadow: {
        'soft': '0 1px 1px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)'
      },
      borderRadius: {
        'pill': '9999px'
      }
    },
  },
  plugins: [],
}
