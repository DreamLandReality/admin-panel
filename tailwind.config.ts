import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        foreground: 'hsl(var(--foreground))',
        'foreground-muted': 'hsl(var(--foreground-muted))',
        'muted-foreground': 'hsl(var(--foreground-muted))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          hover: 'hsl(var(--accent-hover))',
          muted: 'hsl(var(--accent-muted))',
        },
        border: 'hsl(var(--border))',
        sidebar: {
          bg: 'hsl(var(--sidebar-bg))',
          text: 'hsl(var(--sidebar-text))',
          'text-active': 'hsl(var(--sidebar-text-active))',
          accent: 'hsl(var(--sidebar-accent))',
        },
        editor: {
          bg: 'hsl(var(--editor-bg))',
          surface: 'hsl(var(--editor-surface))',
          dropdown: 'hsl(var(--editor-dropdown))',
        },
        success: { DEFAULT: 'hsl(var(--success))', bg: 'hsl(var(--success-bg))' },
        warning: { DEFAULT: 'hsl(var(--warning))', bg: 'hsl(var(--warning-bg))' },
        error: { DEFAULT: 'hsl(var(--error))', bg: 'hsl(var(--error-bg))' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        display: ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        h1: ['36px', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.6', fontWeight: '500' }],
        overline: ['10px', { lineHeight: '1.4', letterSpacing: '0.2em', fontWeight: '700' }],
        micro: ['9px', { lineHeight: '1.4', fontWeight: '500' }],
        label: ['10px', { lineHeight: '1.4', fontWeight: '700' }],
        'label-lg': ['11px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      letterSpacing: {
        label: '0.2em',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        float: 'var(--shadow-float)',
        glow: 'var(--shadow-glow)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
      width: {
        '70': '17.5rem', // 280px
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
