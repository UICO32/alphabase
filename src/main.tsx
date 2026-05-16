import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initAPI } from './utils/api'
import { initTheme } from './theme'
import './index.css'

initAPI()
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)