import adapter from '@sveltejs/adapter-node';
import { resolve } from 'node:path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $core: resolve('./../core'),
    },
  },
};

export default config;