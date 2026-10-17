import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ConfigApi {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function criarClienteApi({ supabaseUrl, supabaseAnonKey }: ConfigApi): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('supabaseUrl e supabaseAnonKey são obrigatórios');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
