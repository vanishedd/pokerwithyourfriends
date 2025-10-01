import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        table: {
          felt: '#10462f',
          border: '#0a2d1f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
