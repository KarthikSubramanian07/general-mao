/**
 * Deterministic, seedable PRNG. Every shuffle and every ruleset generation seed
 * flows through here so that an entire match can be replayed bit-for-bit from a
 * single string seed. This is what makes the determinism property tests possible.
 */

/** Hash an arbitrary string seed into a 32-bit integer generator. */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32: fast, well-distributed 32-bit PRNG. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Pick one element. Throws on empty array. */
  pick<T>(items: readonly T[]): T;
  /** A new independent stream derived from a label (stable and reproducible). */
  fork(label: string): Rng;
  readonly seed: string;
}

export function makeRng(seed: string): Rng {
  const h = xmur3(seed);
  const gen = sfc32(h(), h(), h(), h());
  const rng: Rng = {
    seed,
    next: gen,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      return Math.floor(gen() * maxExclusive);
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("cannot pick from empty array");
      return items[Math.floor(gen() * items.length)] as T;
    },
    fork(label: string): Rng {
      return makeRng(`${seed}::${label}`);
    },
  };
  return rng;
}

/** In-place Fisher-Yates shuffle driven by the given Rng. Returns the array. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}
