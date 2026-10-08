/** @type {import('tailwindcss').Config} */

// Colours are CSS variables (RGB channels) defined in src/index.css for the dark (default) and
// light themes, so every utility works in both and supports `/alpha`.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        elevated: token('elevated'),
        line: token('border'),
        fg: token('text'),
        muted: token('muted'),
        success: token('success'),
        warning: token('warning'),
        danger: token('error'),
        accent: {
          DEFAULT: token('accent'),
          strong: token('accent-strong'),
          fg: token('accent-fg'),
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      fontSize: {
        // Compact scale (UI_SPEC §29).
        '2xs': ['11px', '16px'],
        xs: ['12px', '16px'],
        sm: ['13px', '20px'],
        base: ['14px', '22px'],
        lg: ['16px', '24px'],
        xl: ['19px', '26px'],
      },
    },
  },
  plugins: [],
};
