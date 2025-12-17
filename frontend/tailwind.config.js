module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f3f6fb",
          100: "#e7edf7",
          200: "#c4d3eb",
          300: "#9fb9df",
          400: "#5674c8",
          500: "#1d3faa",
          600: "#102a7a",
          700: "#0c1f5c",
          800: "#08153d",
          900: "#040b21",
          950: "#020514",
        },
        gold: {
          50: "#fdf7e6",
          100: "#faedc1",
          200: "#f7e39b",
          300: "#f4d975",
          400: "#f1cf4f",
          500: "#d4af37",
          600: "#b2922f",
          700: "#907627",
          800: "#6e591f",
          900: "#4c3c17",
        },
      },
    },
  },
  plugins: [],
};
