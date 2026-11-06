import { defineConfig } from 'vite';

// Dev server: semua request /api diteruskan ke backend Flask (python backend/app.py)
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000'
    }
  }
});
