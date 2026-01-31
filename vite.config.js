import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Isso aqui ajuda a resolver problemas de imports antigos
  resolve: {
    alias: {
      // Força o sistema a resolver caminhos corretamente
      src: "/src",
    },
  },

  build: {
    // Aumenta o limite de aviso (para não te assustar com warnings)
    chunkSizeWarningLimit: 1600,

    // Configurações simples e seguras para o Rollup
    rollupOptions: {
      output: {
        // Garante que bibliotecas de terceiros fiquem em arquivos separados
        // mas deixa o Vite decidir como fazer isso (menos chance de erro)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
})