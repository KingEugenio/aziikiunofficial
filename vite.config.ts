import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      viteCompression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
      viteCompression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Enable minification with Terser for maximum compression
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          unused: true,
          dead_code: true,
        },
        mangle: true,
        output: {
          comments: false,
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/@supabase/')) {
              return 'vendor-supabase';
            }
            // Separate large components
            if (id.includes('node_modules/html2canvas/')) {
              return 'vendor-html2canvas';
            }
            return undefined;
          },
          // Optimize asset naming and hashing
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|gif|svg/.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          // Compact output
          format: 'es',
          compact: true,
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
