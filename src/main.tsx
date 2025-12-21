import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

// Apply stored theme before React hydration to prevent flash
const storedTheme = localStorage.getItem('patentbot-theme');
const theme = storedTheme === 'light' ? 'light' : 'dark';
document.documentElement.classList.add(theme);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
