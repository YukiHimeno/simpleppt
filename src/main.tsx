import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/app.css'

// 不用 StrictMode：dev 下双重挂载会让流水线阶段自动触发的 LLM 调用翻倍
createRoot(document.getElementById('root')!).render(<App />)

// 生产环境注册 Service Worker，让站点可被保存为 PWA 并支持离线缓存
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
