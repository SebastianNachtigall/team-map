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
      input: {
        main: resolve(__dirname, 'static/js/main.ts')
      },
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
});
