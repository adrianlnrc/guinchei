import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { criarApi, criarClienteApi } from '@guinchei/api';
import '@guinchei/ui/estilos.css';
import { App } from './App';

const queryClient = new QueryClient();

// Supabase do ambiente (local: `pnpm supabase start`; veja .env.example).
const api = criarApi(
  criarClienteApi({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  }),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App api={api} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
