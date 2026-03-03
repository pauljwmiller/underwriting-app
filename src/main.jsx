// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { GLOBAL_CSS } from './components/shared/Badges'

// Inject global CSS
const style = document.createElement('style')
style.textContent = GLOBAL_CSS
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
