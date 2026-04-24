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
        purple: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          dark: '#7C3AED',
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
          dark: '#0B0F19',
          mid: '#111827',
          deep: '#030712',
        },
        land: {
          bg: '#F9FAFB',
          card: '#FFFFFF',
          border: '#E5E7EB',
          text: '#111827',
          muted: '#6B7280',
          subtle: '#F3F4F6',
          // dark mode
          'dark-bg': '#0B0F19',
          'dark-card': '#111827',
          'dark-border': '#1F2937',
          'dark-text': '#F9FAFB',
          'dark-muted': '#9CA3AF',
          'dark-subtle': '#1F2937',
        },
        dash: {
          bg: '#F9FAFB',
          sidebar: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E5E7EB',
          'border-light': '#D1D5DB',
          hover: '#F3F4F6',
          text: '#111827',
          muted: '#6B7280',
          accent: '#6366F1',
        },
        sage: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
          50: '#EEF2FF',
          100: '#E0E7FF',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        glass: '20px',
        pill: '9999px',
        '2xl': '16px',
        '3xl': '24px',
      },
      backdropBlur: {
        glass: '24px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        glow: '0 0 20px rgba(99, 102, 241, 0.3)',
        'glow-accent': '0 0 20px rgba(139, 92, 246, 0.3)',
        'card-soft': '0 4px 20px -2px rgba(0,0,0,0.05)',
        'card-hover': '0 10px 40px -4px rgba(0,0,0,0.08)',
        'window': '0 8px 40px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
        'dash-sm': '0 1px 2px rgba(0,0,0,0.02)',
        'dash-card': '0 4px 20px -2px rgba(0,0,0,0.03)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        'gradient-surface': 'linear-gradient(180deg, #FFFFFF, #F9FAFB)',
        'gradient-surface-dark': 'linear-gradient(180deg, #111827, #0B0F19)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
