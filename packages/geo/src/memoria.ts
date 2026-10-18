// Dublê em memória do ServicoMapas, para testes dos apps (sem rede nem token).
import {
  dentroDoDF,
  ErroMapas,
  type Endereco,
  type Ponto,
  type Rota,
  type ServicoMapas,
} from './index';

export interface ConfigMapasEmMemoria {
  /** Endereços que a busca encontra (fora do DF são ignorados, como no Mapbox). */
  enderecos: Endereco[];
  /** Rota fixa; sem ela, a rota é a reta entre os pontos. `null`: não há rota. */
  rota?: Rota | null;
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Distância em linha reta (haversine), em km. */
function kmEntre(a: Ponto, b: Ponto): number {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function criarServicoMapasEmMemoria({
  enderecos,
  rota,
}: ConfigMapasEmMemoria): ServicoMapas {
  return {
    async buscarEnderecos(texto) {
      const q = normalizar(texto.trim());
      if (q.length < 3) return [];
      return enderecos.filter((e) => normalizar(e.rotulo).includes(q) && dentroDoDF(e.ponto));
    },

    async enderecoDoPonto(ponto) {
      const maisPerto = [...enderecos].sort(
        (a, b) => kmEntre(a.ponto, ponto) - kmEntre(b.ponto, ponto),
      )[0];
      return maisPerto ? { ponto, rotulo: maisPerto.rotulo } : null;
    },

    async rota(origem, destino) {
      if (rota === null) throw new ErroMapas('sem_rota', 'Não há rota de carro entre os pontos');
      if (rota) return rota;
      const km = kmEntre(origem, destino);
      return {
        km,
        minutos: Math.round(km * 1.5),
        linha: [
          [origem.lng, origem.lat],
          [destino.lng, destino.lat],
        ],
      };
    },
  };
}
