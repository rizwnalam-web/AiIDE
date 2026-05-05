import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AgentModeProvider } from './services/AgentModeProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AgentModeProvider>
      <App />
    </AgentModeProvider>
  </StrictMode>,
);
