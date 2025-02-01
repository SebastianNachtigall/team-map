import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'static',
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/pins': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/connections': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true
      },
      '/events': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    },
    fs: {
      strict: false,
      allow: ['.']
    }
  },
  resolve: {
    alias: {
      '/css': resolve(__dirname, './static/css'),
      '/js': resolve(__dirname, './static/js'),
      '@': resolve(__dirname, './static/js')
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  },
  optimizeDeps: {
    exclude: []  // Remove static from exclude since we're not using publicDir
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    assetsDir: 'assets',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return 'assets/[name].[hash].[ext]';
          
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (ext === 'css') {
            return `static/css/[name].[hash].[ext]`;
          }
          return 'assets/[name].[hash].[ext]';
        }
      }
    }
  }
});
