// 频率刻度点数组
export type FrequencyTick = {
  value: number;
  label: string;
};

export type FrequencyRange = {
  frequencyName: string;
  range: [number, number];
  color: string;
  level?: number;
  slashStyle: {
    forward: boolean;
    backward: boolean;
  };
  customInfo: {
    description: string;
    power: string;
    status: string;
  };
};

export type FrequencyGroup = {
  typeName: string;
  ranges: FrequencyRange[];
};

export type FrequencyMatch = FrequencyRange & {
  typeName: string;
};

export const frequencyTicks: FrequencyTick[] = [
  { value: 0, label: '0kHz' },
  { value: 500000, label: '500kHz' },
  { value: 1000000, label: '1000kHz' },
  { value: 100000000, label: '100MHz' },
  { value: 200000000, label: '200MHz' },
  { value: 300000000, label: '300MHz' },
  { value: 400000000, label: '400MHz' },
  { value: 500000000, label: '500MHz' },
  { value: 600000000, label: '600MHz' },
  { value: 700000000, label: '700MHz' },
  { value: 800000000, label: '800MHz' },
  { value: 900000000, label: '900MHz' },
  { value: 1000000000, label: '1000MHz' },
  { value: 15000000000, label: '15GHz' },
  { value: 30000000000, label: '30GHz' },
  { value: 45000000000, label: '45GHz' },
  { value: 60000000000, label: '60GHz' },
];

// 频率数组
export const data: FrequencyGroup[] = [
  {
    typeName: '无线设备1',
    ranges: [
      {
        frequencyName: '设备0',
        range: [0, 140000000], // 0kHz-140MHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备A',
        range: [35000, 140000000], // 35kHz-140MHz todo 无法渲染
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备B',
        range: [90000000, 140000000], // 90MHz-140MHz
        color: '#4299e1',
        slashStyle: { forward: false, backward: true },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备B',
        range: [90000000, 140000000], // 90MHz-140MHz
        color: '#4299e1',
        slashStyle: { forward: false, backward: true },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备C',
        range: [1000000, 500000000], // 1MHz-500MHz
        color: '#4299e1',
        slashStyle: { forward: false, backward: true },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备d',
        range: [10000000, 50000000], // 10MHz-50MHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备dd',
        range: [10000000, 50000000], // 10MHz-50MHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备e',
        range: [10000000, 500000000], // 10MHz-500MHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
    ],
  },
  {
    typeName: '无线设备2',
    ranges: [
      {
        frequencyName: '设备c',
        range: [1000000, 5000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备c',
        range: [1000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备c',
        range: [1000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备c',
        range: [1000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备c',
        range: [1000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备d',
        range: [100000, 500000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
    ],
  },
  {
    typeName: '无线设备3',
    ranges: [
      {
        frequencyName: '设备1',
        range: [100000, 5000000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备2',
        range: [10000000, 5000000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
    ],
  },
  {
    typeName: '无线设备4',
    ranges: [
      {
        frequencyName: '设备1',
        range: [1000000, 50000000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备2',
        range: [10000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: false },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备3',
        range: [1000000, 500000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: true, backward: true },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
      {
        frequencyName: '设备4',
        range: [1000000, 600000000], // 100kHz-500kHz
        color: '#4299e1',
        slashStyle: { forward: false, backward: true },
        customInfo: {
          description: '测试设备',
          power: '10W',
          status: '正常',
        },
      },
    ],
  },
];
