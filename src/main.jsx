// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ResetPassword from './components/ResetPassword'
import { GLOBAL_CSS } from './components/shared/Badges'

// Inject global CSS
const style = document.createElement('style')
style.textContent = GLOBAL_CSS
document.head.appendChild(style)

const path = window.location.pathname

const RootComponent = path === '/reset-password' ? ResetPassword : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
)
