import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'components': path.resolve(__dirname, './src/components'),
      'assets': path.resolve(__dirname, './src/assets'),
      'views': path.resolve(__dirname, './src/views'),
      'layouts': path.resolve(__dirname, './src/layouts'),
      'theme': path.resolve(__dirname, './src/theme'),
      'contexts': path.resolve(__dirname, './src/contexts'),
      'services': path.resolve(__dirname, './src/services'),
      'utils': path.resolve(__dirname, './src/utils'),
      'schema': path.resolve(__dirname, './src/schema'),
      'routes': path.resolve(__dirname, './src/routes.tsx'),
      'routes.js': path.resolve(__dirname, './src/routes.tsx'),
      'roles': path.resolve(__dirname, './src/roles.ts'),
      'roles.js': path.resolve(__dirname, './src/roles.ts'),
      'constant': path.resolve(__dirname, './src/constant.ts'),
      'constant.js': path.resolve(__dirname, './src/constant.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          data: ["@tanstack/react-query", "axios", "zod", "react-hook-form", "@hookform/resolvers"],
          interface: [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "cmdk",
            "sonner",
          ],
          analytics: ["recharts"],
        },
      },
    },
  },
});
