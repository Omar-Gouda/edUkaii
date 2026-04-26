/** @type {import('tailwindcss').Config} */
import colors from "./src/Constants/Colors.js";

export default {
 content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        background: colors.background,
        sectionBg: colors.sectionBg,
        text: colors.text,
        mutedText: colors.mutedText,
      },
    },
  },
  plugins: [],
};