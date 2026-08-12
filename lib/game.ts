import type { GameBootstrap, GameSnapshot } from './types';

export function statusFor(snapshot: Pick<GameSnapshot, 'complete' | 'won'>): GameBootstrap['status'] {
  if (snapshot.won) return 'won';
  if (snapshot.complete) return 'lost';
  return 'playing';
}

export function toBootstrap(snapshot: GameSnapshot, archive: boolean): GameBootstrap {
  return {
    product: 'TollyRiddl',
    archive,
    status: statusFor(snapshot),
    ...snapshot,
  };
}

