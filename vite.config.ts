import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Ensure firebase-applet-config.json exists during build (e.g. on Render where it's gitignored)
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  try {
    fs.writeFileSync(configPath, JSON.stringify({}));
    console.log('[Build] Created stub firebase-applet-config.json for production build');
  } catch (err) {
    console.error('[Build] Failed to create stub firebase-applet-config.json:', err);
  }
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true
        }
      }
    },
  };
});
