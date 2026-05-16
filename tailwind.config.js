/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        rasta: {
          green: '#1a7a2e',
          'green-light': '#2db84b',
          yellow: '#f5c518',
          red: '#c0392b',
          'red-light': '#e74c3c',
          dark: '#0d0d0d',
          charcoal: '#1a1a1a',
          smoke: '#2a2a2a',
          cream: '#f5f0e8',
          gold: '#d4a017',
        }
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      backgroundImage: {
        'rasta-gradient': 'linear-gradient(135deg, #1a7a2e 0%, #f5c518 50%, #c0392b 100%)',
        'dark-texture': 'radial-gradient(ellipse at top, #1a2a1a 0%, #0d0d0d 70%)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
