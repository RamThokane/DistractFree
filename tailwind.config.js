/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
        },
        accent: {
          DEFAULT: '#34D399',
          light: '#6EE7B7',
          dark: '#10B981',
        },
        warning: {
          DEFAULT: '#F87171',
          light: '#FCA5A5',
          dark: '#EF4444',
        },
        surface: {
          dark: '#0F172A',
          mid: '#1E293B',
          deep: '#0B1120',
        },
        land: {
          bg: '#F8F9FB',
          card: '#FFFFFF',
          border: '#E8EBF0',
          text: '#1A1D23',
          muted: '#6B7280',
          subtle: '#F1F3F6',
          // dark mode
          'dark-bg': '#111315',
          'dark-card': '#1C1F23',
          'dark-border': '#2A2F36',
          'dark-text': '#F5F5F5',
          'dark-muted': '#9CA3AF',
          'dark-subtle': '#1C1F23',
        },
        // Dashboard surfaces — light, editorial (matches landing page)
        dash: {
          bg: '#F8F9FB',
          sidebar: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E5E7EB',
          'border-light': '#D1D5DB',
          hover: '#F3F4F6',
          text: '#111111',
          muted: '#6B7280',
          accent: '#3FAE6A',
        },
        sage: {
          DEFAULT: '#4A7C6F',
          light: '#5E9A8A',
          dark: '#3A6359',
          50: '#F0F7F5',
          100: '#D9EDE7',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        glass: '24px',
        pill: '9999px',
      },
      backdropBlur: {
        glass: '20px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(99, 102, 241, 0.4)',
        'glow-accent': '0 0 20px rgba(52, 211, 153, 0.4)',
        'card-soft': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'window': '0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        'dash-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'dash-card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
