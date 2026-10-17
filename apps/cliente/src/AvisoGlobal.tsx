import { Aviso } from '@guinchei/ui';
import { useFluxo } from './fluxo';

export function AvisoGlobal() {
  const { aviso } = useFluxo();
  return aviso ? <Aviso>{aviso}</Aviso> : null;
}
