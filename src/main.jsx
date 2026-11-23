import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './data/store.jsx'
import AuthGate from './components/AuthGate.jsx'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>
      {({ hid }) => (
        <AppProvider key={hid} hid={hid}>
          <App />
        </AppProvider>
      )}
    </AuthGate>
  </React.StrictMode>,
)
