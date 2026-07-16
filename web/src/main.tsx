import { createRoot } from 'react-dom/client'
import App from './App'
import './fonts/nanum-barun-gothic.css'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(<App />)
