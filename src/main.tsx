import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Resolve the mount node defensively. A missing #root would otherwise throw
// here and leave a completely blank page.
let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

// Startup failures must not render a white screen. The boot guard installed in
// index.html shows a real "Reload" message, but it only fires while nothing has
// mounted - so routing uncaught startup errors into it is safe and never masks
// a running application. The original error is still logged for debugging.
const bootGuard = (window as any).__aegisBootGuard as
  | ((message: string) => void)
  | undefined;

function reportStartupFailure(message: string, error: unknown) {
  console.error('[AEGIS] Startup failure:', message, error);
  if (typeof bootGuard === 'function') {
    try {
      bootGuard(message);
    } catch {
      /* the guard itself failed; nothing more we can do */
    }
  }
}

window.addEventListener('error', (event) => {
  reportStartupFailure(
    'A critical error stopped the application from running. Reload to try again.',
    event.error ?? event.message,
  );
});

window.addEventListener('unhandledrejection', (event) => {
  reportStartupFailure(
    'The application failed to finish starting up. Reload to try again.',
    event.reason,
  );
});

try {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  reportStartupFailure(
    'The application could not start. Reload to try again.',
    error,
  );
  throw error;
}