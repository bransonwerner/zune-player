import { createRoot } from 'react-dom/client'
import '@fontsource/open-sans/300.css'
import '@fontsource/open-sans/400.css'
import '@fontsource/open-sans/600.css'
import './index.css'
import App from './App.tsx'

// No StrictMode: its double-invoked effects would register two Spotify
// players and redeem the one-time OAuth code twice.
createRoot(document.getElementById('root')!).render(<App />)
