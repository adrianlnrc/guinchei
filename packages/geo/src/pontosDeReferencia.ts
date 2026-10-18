// Pontos conhecidos para os testes da regra do DF (só testes importam este arquivo).
//
// Os mesmos pontos, com a mesma resposta, estão em supabase/tests/trajeto_do_pedido.test.sql;
// sincronia-sql.test.ts confere que as duas listas são iguais, para TS e banco concordarem.
// Coordenadas aproximadas do centro de cada lugar; a distância até a divisa (calculada no
// polígono de limiteDF.ts) fica no comentário para mostrar a folga.
import type { Ponto } from './index';

export interface PontoDeReferencia extends Ponto {
  nome: string;
  noDF: boolean;
}

export const PONTOS_DE_REFERENCIA: readonly PontoDeReferencia[] = [
  { nome: 'Esplanada dos Ministérios', lat: -15.7975, lng: -47.8641, noDF: true }, // ~28 km
  { nome: 'Taguatinga', lat: -15.8336, lng: -48.0566, noDF: true }, // ~19 km
  { nome: 'Planaltina-DF', lat: -15.6203, lng: -47.6522, noDF: true }, // ~13 km
  { nome: 'Gama', lat: -16.0153, lng: -48.0614, noDF: true }, // ~4 km
  { nome: 'Águas Lindas de Goiás', lat: -15.7617, lng: -48.2817, noDF: false }, // ~5 km
  { nome: 'Valparaíso de Goiás', lat: -16.0683, lng: -47.9758, noDF: false }, // ~2 km
  { nome: 'Formosa', lat: -15.5372, lng: -47.3342, noDF: false }, // ~5 km
  { nome: 'Goiânia', lat: -16.6869, lng: -49.2648, noDF: false }, // ~130 km
];
