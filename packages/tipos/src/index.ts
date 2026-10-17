// Tipos do banco gerados do schema do Supabase (`pnpm gen:tipos`, não edite database.ts à mão)
// e tipos compartilhados escritos à mão.
export * from './database';

export const PAPEIS = ['cliente', 'guincheiro', 'operacao'] as const;
export type Papel = (typeof PAPEIS)[number];
