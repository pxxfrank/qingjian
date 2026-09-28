import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 多页应用：list（便笺列表） + note（便笺编辑器） + launcher（贴边启动器） + capture（速记条）
// base './' 保证 file:// 协议下资源相对路径可加载
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    // 注意：本环境下 Vite 的 emptyOutDir 走 safe-delete（回收站）会失败并中断构建，
    // 故关闭自动清空；需要彻底重建时手动清理 frontend/dist 后再构建。
    emptyOutDir: false,
    rollupOptions: {
      input: {
        list: resolve(__dirname, 'list/index.html'),
        note: resolve(__dirname, 'note/index.html'),
        launcher: resolve(__dirname, 'launcher/index.html'),
        capture: resolve(__dirname, 'capture/index.html')
      }
    }
  }
})
