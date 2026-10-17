import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/card-deck-swapper/',
  plugins: [{
    name: 'production-content-security-policy',
    apply: 'build',
    transformIndexHtml() {
      return [{
        tag: 'meta',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://mtgjson.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
        },
        injectTo: 'head-prepend',
      }];
    },
  }],
  build: { target: 'es2022' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
});
