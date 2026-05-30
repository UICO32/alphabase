import ReactDOM from 'react-dom/client'
import App from './App'
import { initAPI } from './utils/api'
import { initTheme } from './theme'
import { startSystemThemeSync } from './stores/libraryStore'
import './index.css'

;(window as any).__appStartTs = performance.now()

initAPI()
initTheme()
startSystemThemeSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)