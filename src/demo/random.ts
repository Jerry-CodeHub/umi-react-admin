/**
 * 确定性伪随机（mulberry32）。每类实体用独立的子流（按名字派生种子）：
 * 给某个实体加字段、改分布，不会打乱其它实体的数据。
 */
export type Rng = {
  /** [0, 1) */
  next(): number;
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number;
  /** [min, max) 浮点 */
  float(min: number, max: number): number;
  bool(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** 按权重抽取：weights 与 items 一一对应 */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** 正态分布（Box–Muller），可选截断到 [min, max] */
  normal(mean: number, sd: number, min?: number, max?: number): number;
  /** 对数正态：中位数 median、离散度 sigma（处理时长类长尾数据） */
  logNormal(median: number, sigma: number): number;
  shuffle<T>(items: T[]): T[];
};

const hashSeed = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const createRng = (seed: number | string): Rng => {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean: number, sd: number, min = -Infinity, max = Infinity) => {
    const u = 1 - next();
    const v = next();
    const value = mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return Math.min(max, Math.max(min, value));
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    bool: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)],
    weighted: (items, weights) => {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i];
        if (roll < 0) {
          return items[i];
        }
      }
      return items[items.length - 1];
    },
    normal,
    logNormal: (median, sigma) => median * Math.exp(normal(0, sigma)),
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    },
  };
};

/** 按权重把 total 分配成整数份（最大余数法），每份至少 min */
export const allocate = (weights: readonly number[], total: number, min = 0): number[] => {
  const rest = total - min * weights.length;
  const sum = weights.reduce((s, w) => s + w, 0);
  const raw = weights.map((w) => (w / sum) * rest);
  const counts = raw.map((r) => Math.floor(r));
  let remaining = rest - counts.reduce((s, c) => s + c, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; remaining > 0; k++, remaining--) {
    counts[order[k % order.length].i] += 1;
  }
  return counts.map((c) => c + min);
};
