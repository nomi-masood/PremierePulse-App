import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This securely maps the 'process.env.API_KEY' used in geminiService.ts 
    // to the actual environment variable available during the Netlify build.
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});