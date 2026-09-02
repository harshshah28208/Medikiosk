import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { cleanCorruptStorage } from './utils/storage'

// Purge any corrupted localStorage strings before React hydration
cleanCorruptStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
