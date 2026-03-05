import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
  },

  // Monaco Editor 로컬 번들 최적화 설정
  // - optimizeDeps.include: Vite 사전 번들링 대상에 명시적으로 포함
  //   (누락 시 dev 서버에서 동적 import 오류 발생 가능)
  // - worker.format: ES 모듈 방식으로 worker 번들
  optimizeDeps: {
    include: [
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
    ],
  },
  worker: {
    format: 'es',
  },
});