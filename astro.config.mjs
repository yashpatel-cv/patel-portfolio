// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

/**
 * Static-output build. The entire site compiles to plain HTML/CSS/JS in
 * `dist/`, which the runtime stage (nginx, ARM64) serves with zero Node
 * dependency.
 *
 * `site` drives canonical URLs, og:url/og:image, and sitemap generation.
 * ⚠ Replace with the production domain before going live.
 */
export default defineConfig({
  site: 'https://yashpatel.dev',
  output: 'static',
  compressHTML: true,
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
