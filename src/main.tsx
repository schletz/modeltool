import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './ui/styles/app.css';
import { App } from './ui/app/App';
import { useLanguageStore } from './ui/i18n/language';

document.documentElement.lang = useLanguageStore.getState().language;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
);
