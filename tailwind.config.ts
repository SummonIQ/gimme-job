import tailwindTypography from '@tailwindcss/typography';

const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './constants/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    '!./node_modules/**',
    '!./.next/**',
    '!./dist/**',
    '!./build/**',
    '!./coverage/**',
    '!./.git/**',
  ],
  // Development performance optimization
  ...(process.env.NODE_ENV === 'development' && {
    future: {
      hoverOnlyWhenSupported: true,
    },
  }),
  plugins: [
    tailwindTypography,
    // Add animation delay utilities
    function ({ addUtilities, theme }: any) {
      const delays = theme('animationDelay');
      const utilities = Object.entries(delays).reduce((acc, [key, value]) => {
        return {
          ...acc,
          [`.animation-delay-${key}`]: {
            animationDelay: value,
          },
        };
      }, {});
      addUtilities(utilities);
    },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        border: 'border 4s linear infinite',
        rotate: 'rotate 10s linear infinite',
        shimmer: 'shimmer 2s linear infinite',
        'spin-slow': 'spin 5s linear infinite',
        spotlight: 'spotlight 2s ease .75s 1 forwards',
        'sun-rays': 'sun-rays 20s linear infinite',
        'text-swap': 'text-swap 6s cubic-bezier(0.83, 0, 0.17, 1) infinite',
        blob: 'blob 7s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        'fade-in': 'fade-in 1s ease-out',
      },
      animationDelay: {
        '2000': '2s',
        '3000': '3s',
        '4000': '4s',
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      maxWidth: {
        '8xl': '86rem',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        page: 'hsl(var(--page))',
        border: 'hsl(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        'brand-1': {
          lightest: 'hsl(var(--brand-1-lightest))',
          lighter: 'hsl(var(--brand-1-lighter))',
          DEFAULT: 'hsl(var(--brand-1))',
          dark: 'hsl(var(--brand-1-dark))',
          darker: 'hsl(var(--brand-1-darker))',
          darkest: 'hsl(var(--brand-1-darkest))',
        },
        'brand-2': {
          lightest: 'hsl(var(--brand-2-lightest))',
          lighter: 'hsl(var(--brand-2-lighter))',
          DEFAULT: 'hsl(var(--brand-2))',
          dark: 'hsl(var(--brand-2-dark))',
          darker: 'hsl(var(--brand-2-darker))',
          darkest: 'hsl(var(--brand-2-darkest))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        sidebar: {
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'sun-rays': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        border: {
          to: { '--border-angle': '360deg' },
        },
        rotate: {
          '0%': { transform: 'rotate(0deg) scale(10)' },
          '100%': { transform: 'rotate(-360deg) scale(10)' },
        },
        shimmer: {
          from: {
            backgroundPosition: '0 0',
          },
          to: {
            backgroundPosition: '-200% 0',
          },
        },
        'text-swap': {
          '0%, 16.66%': { transform: 'translateY(0%)', opacity: '1' },
          '16.67%, 33.33%': { transform: 'translateY(-100%)', opacity: '0' },
          '33.34%, 50%': { transform: 'translateY(-100%)', opacity: '1' },
          '50.01%, 66.66%': { transform: 'translateY(-200%)', opacity: '0' },
          '66.67%, 83.33%': { transform: 'translateY(-200%)', opacity: '1' },
          '83.34%, 100%': { transform: 'translateY(-300%)', opacity: '0' },
        },
        blob: {
          '0%, 100%': {
            transform: 'translate(0, 0) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0) rotate(0deg)',
          },
          '50%': {
            transform: 'translateY(-20px) rotate(5deg)',
          },
        },
        'fade-in': {
          from: {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
      },
    },
  },
};

export default config;
