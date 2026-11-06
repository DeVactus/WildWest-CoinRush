
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],

  // Dev server: request /api diteruskan ke backend Flask
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
  }
});
