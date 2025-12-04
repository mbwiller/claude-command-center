import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,  // Fail if port is in use, don't auto-switch
    open: false,       // Tauri opens the window, not browser
  },
  build: {
    outDir: 'dist',
  },
});
