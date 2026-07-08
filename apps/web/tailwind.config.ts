import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#16263f', 700: '#1f3350', 900: '#0f1b2e' },
        beacon: { DEFAULT: '#e6a53a', 600: '#d18f22' },
        paper: '#faf8f3',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0) translateX(0)' }, '50%': { transform: 'translateY(-14px) translateX(6px)' } },
        pulseBeacon: { '0%,100%': { boxShadow: '0 0 0 0 rgba(230,165,58,0.45)' }, '50%': { boxShadow: '0 0 0 10px rgba(230,165,58,0)' } },
        countUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-up': 'fadeUp .6s ease-out both',
        'fade-in': 'fadeIn .4s ease-out both',
        float: 'float 7s ease-in-out infinite',
        'pulse-beacon': 'pulseBeacon 2.2s ease-in-out infinite',
        'count-up': 'countUp .5s ease-out both',
      },
    },
  },
  plugins: [],
} satisfies Config;
