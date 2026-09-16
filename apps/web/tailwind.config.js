/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Signature indigo — the brand
        brand: {
          50:  '#eef4ff',
          100: '#dbe5ff',
          200: '#bed0ff',
          300: '#92aeff',
          400: '#5f84ff',
          500: '#3b5bff',
          600: '#2540e6',
          700: '#1d32ba',
          800: '#1c2d96',
          900: '#1d2c78',
          950: '#131d4a',
        },
        // Warm emerald — for positive/synced states
        accent: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
        },
        // Warm amber — for pending/expiring
        alert: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
        },
        // Warm neutrals (replace Tailwind's cold slate with stone)
        slate: {
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
          300: '#D6D3D1',
          400: '#A8A29E',
          500: '#78716C',
          600: '#57534E',
          700: '#44403C',
          800: '#292524',
          900: '#1C1917',
          950: '#0C0A09',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        'xs':  ['0.75rem',    { lineHeight: '1rem' }],
        'sm':  ['0.8125rem',  { lineHeight: '1.25rem' }],
        'base':['0.875rem',   { lineHeight: '1.375rem' }],
        'md':  ['0.9375rem',  { lineHeight: '1.5rem' }],
        'lg':  ['1.0625rem',  { lineHeight: '1.625rem' }],
        'xl':  ['1.25rem',    { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem',     { lineHeight: '2rem' }],
        '3xl': ['1.875rem',   { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(28,25,23,0.04), 0 1px 3px 0 rgba(28,25,23,0.06)',
        pop:  '0 12px 32px rgba(28,25,23,0.12), 0 4px 8px rgba(28,25,23,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 220ms cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};