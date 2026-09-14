// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://rahulr.in',
  trailingSlash: 'always',
  integrations: [sitemap()],
  redirects: {
    // legacy Jekyll (Minimal Mistakes) archive URLs
    '/year-archive/': '/posts/',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: false,
    },
  },
});
