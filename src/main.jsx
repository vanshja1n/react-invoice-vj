import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <App />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>
);
