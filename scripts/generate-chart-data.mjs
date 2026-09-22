// 首页图表演示数据生成器：确定性伪随机（固定种子），可随时重新生成并逐字节复现。
// 用法：node scripts/generate-chart-data.mjs（输出到 public/data/charts/，数据为项目自制）
// 此前 line-slider / scatter-point 取自 AntV 示例数据（AAPL 股价、气温距平），来源与许可不属于本项目。
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../public/data/charts/', import.meta.url));
mkdirSync(outDir, { recursive: true });

let seed = 20260921;
/** 线性同余伪随机，返回 [0, 1) */
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (min, max) => Math.round(min + rand() * (max - min));
/** 近似标准正态（Irwin–Hall） */
const gaussian = () => {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += rand();
  return sum - 3;
};
const isoDate = (date) => date.toISOString().slice(0, 10);
const write = (name, data) => {
  writeFileSync(join(outDir, name), JSON.stringify(data));
  console.log(`${name}: ${Array.isArray(data) ? data.length : 1} 条`);
};

// 折线（带缩略轴）：示例指数的工作日收盘值，几何随机游走
{
  const rows = [];
  const date = new Date(Date.UTC(2021, 0, 4));
  let close = 100;
  while (rows.length < 750) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      close = Math.max(20, close * (1 + 0.0004 + 0.014 * gaussian()));
      rows.push({ date: isoDate(date), close: Math.round(close * 100) / 100 });
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  write('line-slider.json', rows);
}

// 散点：按月的示例指标（缓慢上升趋势 + 季节波动 + 噪声）
{
  const rows = [];
  for (let year = 1960; year <= 2025; year++) {
    for (let month = 0; month < 12; month++) {
      const t = year - 1960 + month / 12;
      const value = -0.4 + 0.018 * t + 0.08 * Math.sin((month / 12) * 2 * Math.PI) + 0.12 * gaussian();
      rows.push({ date: isoDate(new Date(Date.UTC(year, month, 1))), value: Math.round(value * 100) / 100 });
    }
  }
  write('scatter-point.json', rows);
}

// 堆叠柱状图：各区域 × 年龄段人数
{
  const regions = ['华北', '华东', '华南', '华中', '西南', '西北', '东北', '港澳台', '海外一区', '海外二区'];
  const ages = ['<18', '18-29', '30-44', '45-59', '60+'];
  const rows = [];
  for (const state of regions) {
    for (const age of ages) rows.push({ state, age, population: between(20_000, 900_000) });
  }
  write('column-stacked.json', rows);
}

// 旭日图：技术栈使用量层级（叶子节点带 sum）
{
  const tree = {
    前端: ['React', 'Vue', 'Angular', 'Svelte', 'Solid'],
    后端: ['Node.js', 'Java', 'Go', 'Python', 'Rust'],
    数据: ['PostgreSQL', 'MySQL', 'Redis', 'ClickHouse'],
    可视化: ['G2', 'ECharts', 'D3', 'Cesium', 'OpenLayers'],
    工程化: ['Webpack', 'Vite', 'pnpm', 'Vitest'],
  };
  write('sunburst.json', {
    name: '技术栈',
    children: Object.entries(tree).map(([name, leaves]) => ({
      name,
      children: leaves.map((leaf) => ({ name: leaf, sum: between(8, 120) })),
    })),
  });
}
