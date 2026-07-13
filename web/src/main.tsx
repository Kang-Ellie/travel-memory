import { createRoot } from 'react-dom/client'
import App from './App'
import 'typeface-nanum-barun-gothic/nanumbarungothic.css'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(<App />)
