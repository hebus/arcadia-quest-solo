import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { Repository } from './infrastructure/persistence/repository';
import { setCampaignRepository } from './stores/campaignStore';
import { setRepository } from './stores/gameStore';
import { setTileRepository } from './stores/tileStore';

try {
  const repo = new Repository();
  setRepository(repo);
  setCampaignRepository(repo);
  setTileRepository(repo);
} catch {
  // IndexedDB indisponible (navigation privée…) : l'application reste utilisable sans sauvegarde locale.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
