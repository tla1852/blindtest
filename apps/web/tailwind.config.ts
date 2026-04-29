import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0A0015', soft: '#12002A', card: '#1A0A35' },
        neon: {
          violet: '#A855F7',
          pink: '#F472B6',
          cyan: '#38BDF8',
          gold: '#FBBF24',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-violet': '0 0 20px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3)',
        'neon-pink': '0 0 20px rgba(244, 114, 182, 0.6), 0 0 40px rgba(244, 114, 182, 0.3)',
        'neon-cyan': '0 0 20px rgba(56, 189, 248, 0.6), 0 0 40px rgba(56, 189, 248, 0.3)',
        'neon-gold': '0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.3)',
      },
      animation: {
        'pulse-neon': 'pulse-neon 1.2s ease-in-out infinite',
        'scanlines': 'scanlines 8s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 30px rgba(244, 114, 182, 0.8), 0 0 60px rgba(244, 114, 182, 0.4)' },
          '50%': { transform: 'scale(1.03)', boxShadow: '0 0 50px rgba(244, 114, 182, 1), 0 0 100px rgba(244, 114, 182, 0.6)' },
        },
        'scanlines': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100vh' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
