import ReactDOM from 'react-dom/client'
import App from './App'
import { initAPI } from './utils/api'
import { initTheme, initPanelHue } from './theme'
import { startSystemThemeSync } from './stores/libraryStore'
import './index.css'

initAPI()
initTheme()
initPanelHue()
startSystemThemeSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)