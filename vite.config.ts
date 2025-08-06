import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig((): UserConfig => {
  return {
    plugins: [react()],
    // 生产环境优化
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    // 开发服务器配置
    server: {
      host: true,
      port: 3004,
    },
    // 构建配置
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    preview: {
      headers: {
        'Cache-Control': 'public, max-age=600',
      },
    },
  };
}); 