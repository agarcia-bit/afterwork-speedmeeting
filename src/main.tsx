import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { MyEntryPage, SignupPage, prefetchEvent } from './annuaire/PublicPages'
import './app.css'

// Deux pages publiques s'ajoutent à l'outil d'organisation :
//   /annuaire/<soirée>        formulaire de consentement et d'inscription
//   /annuaire/moi/<lien>      espace personnel (modifier, retirer son consentement)
function route() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  if (parts[0] === 'annuaire' && parts[1] === 'moi' && parts[2]) {
    return <MyEntryPage token={decodeURIComponent(parts[2])} />
  }
  if (parts[0] === 'annuaire' && parts[1]) {
    const slug = decodeURIComponent(parts[1])
    prefetchEvent(slug)
    return <SignupPage slug={slug} />
  }
  return <App />
}

createRoot(document.getElementById('root')!).render(<StrictMode>{route()}</StrictMode>)
