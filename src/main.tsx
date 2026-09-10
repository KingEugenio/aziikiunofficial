import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {IconContext} from '@phosphor-icons/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Every Phosphor icon in the app defaults to the solid "fill" weight
        from here, so individual call sites never need to pass weight="fill"
        themselves - see the icon imports across src/components for the
        lucide-react -> @phosphor-icons/react name mapping. */}
    <IconContext.Provider value={{ weight: 'fill' }}>
      {/* Catches any uncaught render error anywhere in the app - see
          ErrorBoundary.tsx for why this matters: without it, any
          unexpected error crashes the whole app to a blank white screen
          with zero explanation, which is exactly what was happening. */}
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </IconContext.Provider>
  </StrictMode>,
);
