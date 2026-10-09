// Sliding-window limiter kept in process memory. Fine for one server; with several instances
// (or serverless) replace the Map with Redis or an edge rate limiter.
const hits = new Map<string, number[]>();
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now(), w = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (w.length >= max) { hits.set(key, w); return false; }
  w.push(now); hits.set(key, w);
  if (hits.size > 10_000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return true;
}
