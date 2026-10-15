/** Deterministic hash-seed helpers so mock analytics never drift between renders. */
export function hashSeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededFloat(key: string): number {
  return (hashSeed(key) % 100000) / 100000;
}

export function seededInt(key: string, min: number, max: number): number {
  return min + Math.floor(seededFloat(key) * (max - min + 1));
}
