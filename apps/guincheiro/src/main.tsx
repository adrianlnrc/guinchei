import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@guinchei/ui/estilos.css';
import { Inicio } from './Inicio';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Supabase do ambiente (local: `pnpm supabase start`; veja .env.example). */}
        <Inicio
          supabaseUrl={import.meta.env.VITE_SUPABASE_URL}
          supabaseAnonKey={import.meta.env.VITE_SUPABASE_ANON_KEY}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
