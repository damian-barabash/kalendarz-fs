import { defineConfig } from 'vite'

// Отдельная сборка виджета: один файл dist/widget.js (IIFE, self-contained)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'widget/widget.js',
      name: 'FSKalendarz',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    minify: true,
  },
})
