import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { Repository } from './infrastructure/persistence/repository';
import { setCampaignRepository } from './stores/campaignStore';
import { setRepository } from './stores/gameStore';
import { setCampaignRunRepository } from './stores/campaignRunStore';
import { setGuildRepository } from './stores/guildStore';
import { setTileRepository } from './stores/tileStore';

try {
  const repo = new Repository();
  setRepository(repo);
  setCampaignRepository(repo);
  setTileRepository(repo);
  setGuildRepository(repo);
  setCampaignRunRepository(repo);
} catch {
  // IndexedDB indisponible (navigation privée…) : l'application reste utilisable sans sauvegarde locale.
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
