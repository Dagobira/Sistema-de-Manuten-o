import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Configuração para GitHub Pages
  base: mode === 'production' ? '/Sistema-de-Manuten-o/' : '/',

  // Otimizações de build
  build: {
    // Aumentar limite de warning para chunks grandes
    chunkSizeWarningLimit: 1000,

    // Sourcemaps apenas em dev
    sourcemap: mode !== 'production',

    // Minificação com terser
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },

    // Configuração de chunks manual para otimização
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore'
          ],
          'chart-vendor': ['react-window'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable']
        }
      }
    }
  },

  // Configuração de servidor dev
  server: {
    port: 3000,
    open: true,
    host: true
  },

  // Otimização de dependências
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore'
    ]
  }
}))