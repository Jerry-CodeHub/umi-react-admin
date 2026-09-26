/**
 * 演示数据词库（项目自制）。只放「专有名词」类的双语文本（城市、人名、设备名模板）；
 * 枚举类（告警级别、部门、角色……）只存 key，界面文案走 src/locales。
 * 城市坐标取市中心的公开经纬度，设备权重按城市规模的量级设定（一线城市多、西北少）。
 */
import type { DepartmentKey, RegionKey, RoleKey } from '@/services/types';

export type City = {
  code: string;
  zh: string;
  en: string;
  region: RegionKey;
  lng: number;
  lat: number;
  /** 设备分布权重 */
  weight: number;
};

export const REGIONS: RegionKey[] = ['north', 'east', 'south', 'central', 'southwest', 'northwest', 'northeast'];

export const CITIES: City[] = [
  { code: 'BJ', zh: '北京', en: 'Beijing', region: 'north', lng: 116.407, lat: 39.904, weight: 10 },
  { code: 'TJ', zh: '天津', en: 'Tianjin', region: 'north', lng: 117.2, lat: 39.084, weight: 5 },
  { code: 'SJZ', zh: '石家庄', en: 'Shijiazhuang', region: 'north', lng: 114.514, lat: 38.042, weight: 3 },
  { code: 'TY', zh: '太原', en: 'Taiyuan', region: 'north', lng: 112.549, lat: 37.87, weight: 2 },
  { code: 'HHT', zh: '呼和浩特', en: 'Hohhot', region: 'north', lng: 111.749, lat: 40.842, weight: 1 },
  { code: 'SH', zh: '上海', en: 'Shanghai', region: 'east', lng: 121.474, lat: 31.23, weight: 11 },
  { code: 'HZ', zh: '杭州', en: 'Hangzhou', region: 'east', lng: 120.155, lat: 30.274, weight: 7 },
  { code: 'NJ', zh: '南京', en: 'Nanjing', region: 'east', lng: 118.797, lat: 32.06, weight: 6 },
  { code: 'SZ', zh: '苏州', en: 'Suzhou', region: 'east', lng: 120.585, lat: 31.299, weight: 5 },
  { code: 'HF', zh: '合肥', en: 'Hefei', region: 'east', lng: 117.227, lat: 31.821, weight: 4 },
  { code: 'JN', zh: '济南', en: 'Jinan', region: 'east', lng: 117.121, lat: 36.651, weight: 3 },
  { code: 'QD', zh: '青岛', en: 'Qingdao', region: 'east', lng: 120.383, lat: 36.067, weight: 4 },
  { code: 'FZ', zh: '福州', en: 'Fuzhou', region: 'east', lng: 119.296, lat: 26.074, weight: 3 },
  { code: 'XM', zh: '厦门', en: 'Xiamen', region: 'east', lng: 118.089, lat: 24.48, weight: 3 },
  { code: 'GZ', zh: '广州', en: 'Guangzhou', region: 'south', lng: 113.264, lat: 23.129, weight: 9 },
  { code: 'SZN', zh: '深圳', en: 'Shenzhen', region: 'south', lng: 114.058, lat: 22.543, weight: 10 },
  { code: 'NN', zh: '南宁', en: 'Nanning', region: 'south', lng: 108.366, lat: 22.817, weight: 2 },
  { code: 'HK', zh: '海口', en: 'Haikou', region: 'south', lng: 110.199, lat: 20.044, weight: 1 },
  { code: 'WH', zh: '武汉', en: 'Wuhan', region: 'central', lng: 114.305, lat: 30.593, weight: 6 },
  { code: 'CS', zh: '长沙', en: 'Changsha', region: 'central', lng: 112.938, lat: 28.228, weight: 4 },
  { code: 'ZZ', zh: '郑州', en: 'Zhengzhou', region: 'central', lng: 113.625, lat: 34.747, weight: 4 },
  { code: 'NC', zh: '南昌', en: 'Nanchang', region: 'central', lng: 115.858, lat: 28.683, weight: 2 },
  { code: 'CD', zh: '成都', en: 'Chengdu', region: 'southwest', lng: 104.066, lat: 30.573, weight: 7 },
  { code: 'CQ', zh: '重庆', en: 'Chongqing', region: 'southwest', lng: 106.551, lat: 29.563, weight: 6 },
  { code: 'KM', zh: '昆明', en: 'Kunming', region: 'southwest', lng: 102.833, lat: 24.88, weight: 3 },
  { code: 'GY', zh: '贵阳', en: 'Guiyang', region: 'southwest', lng: 106.63, lat: 26.647, weight: 2 },
  { code: 'XA', zh: '西安', en: "Xi'an", region: 'northwest', lng: 108.94, lat: 34.341, weight: 5 },
  { code: 'LZ', zh: '兰州', en: 'Lanzhou', region: 'northwest', lng: 103.834, lat: 36.061, weight: 2 },
  { code: 'WLMQ', zh: '乌鲁木齐', en: 'Urumqi', region: 'northwest', lng: 87.617, lat: 43.826, weight: 2 },
  { code: 'YC', zh: '银川', en: 'Yinchuan', region: 'northwest', lng: 106.231, lat: 38.487, weight: 1 },
  { code: 'SY', zh: '沈阳', en: 'Shenyang', region: 'northeast', lng: 123.431, lat: 41.806, weight: 3 },
  { code: 'DL', zh: '大连', en: 'Dalian', region: 'northeast', lng: 121.615, lat: 38.914, weight: 3 },
  { code: 'HEB', zh: '哈尔滨', en: 'Harbin', region: 'northeast', lng: 126.535, lat: 45.803, weight: 3 },
  { code: 'CC', zh: '长春', en: 'Changchun', region: 'northeast', lng: 125.324, lat: 43.817, weight: 2 },
];

/** 常见姓氏（按人口比例粗略加权） */
export const SURNAMES: [zh: string, pinyin: string, weight: number][] = [
  ['王', 'wang', 10],
  ['李', 'li', 10],
  ['张', 'zhang', 9],
  ['刘', 'liu', 8],
  ['陈', 'chen', 8],
  ['杨', 'yang', 6],
  ['黄', 'huang', 5],
  ['赵', 'zhao', 5],
  ['吴', 'wu', 5],
  ['周', 'zhou', 5],
  ['徐', 'xu', 4],
  ['孙', 'sun', 4],
  ['朱', 'zhu', 3],
  ['高', 'gao', 3],
  ['林', 'lin', 3],
  ['何', 'he', 3],
  ['郭', 'guo', 3],
  ['罗', 'luo', 3],
  ['梁', 'liang', 2],
  ['宋', 'song', 2],
  ['郑', 'zheng', 2],
  ['谢', 'xie', 2],
  ['韩', 'han', 2],
  ['唐', 'tang', 2],
  ['冯', 'feng', 2],
  ['许', 'xu', 2],
  ['邓', 'deng', 2],
  ['曹', 'cao', 2],
  ['彭', 'peng', 2],
  ['曾', 'zeng', 2],
  ['肖', 'xiao', 2],
  ['田', 'tian', 1],
  ['董', 'dong', 1],
  ['潘', 'pan', 1],
  ['袁', 'yuan', 1],
  ['蒋', 'jiang', 1],
  ['蔡', 'cai', 1],
  ['余', 'yu', 1],
  ['杜', 'du', 1],
  ['叶', 'ye', 1],
  ['程', 'cheng', 1],
  ['魏', 'wei', 1],
  ['苏', 'su', 1],
  ['吕', 'lv', 1],
  ['丁', 'ding', 1],
  ['沈', 'shen', 1],
  ['任', 'ren', 1],
  ['姜', 'jiang', 1],
  ['范', 'fan', 1],
  ['方', 'fang', 1],
];

/** 名字：刻意避开与知名人物易撞名的单字（如 娜、翔、宁、军），generate.test.ts 另有名单校验 */
export const GIVEN_NAMES: [zh: string, pinyin: string][] = [
  ['子涵', 'zihan'],
  ['浩然', 'haoran'],
  ['欣怡', 'xinyi'],
  ['宇轩', 'yuxuan'],
  ['梓萱', 'zixuan'],
  ['思远', 'siyuan'],
  ['雨桐', 'yutong'],
  ['俊杰', 'junjie'],
  ['佳怡', 'jiayi'],
  ['一诺', 'yinuo'],
  ['晨阳', 'chenyang'],
  ['若曦', 'ruoxi'],
  ['嘉懿', 'jiayi'],
  ['明哲', 'mingzhe'],
  ['书瑶', 'shuyao'],
  ['志强', 'zhiqiang'],
  ['建华', 'jianhua'],
  ['丽娟', 'lijuan'],
  ['海燕', 'haiyan'],
  ['文博', 'wenbo'],
  ['雅婷', 'yating'],
  ['天佑', 'tianyou'],
  ['梦琪', 'mengqi'],
  ['博文', 'bowen'],
  ['诗涵', 'shihan'],
  ['皓轩', 'haoxuan'],
  ['语嫣', 'yuyan'],
  ['泽宇', 'zeyu'],
  ['可欣', 'kexin'],
  ['晓东', 'xiaodong'],
  ['秀兰', 'xiulan'],
  ['国庆', 'guoqing'],
  ['春梅', 'chunmei'],
  ['立新', 'lixin'],
  ['慧敏', 'huimin'],
  ['振宇', 'zhenyu'],
  ['静怡', 'jingyi'],
  ['家豪', 'jiahao'],
  ['思琪', 'siqi'],
  ['凯文', 'kaiwen'],
  ['雪莹', 'xueying'],
  ['鹏飞', 'pengfei'],
  ['婉清', 'wanqing'],
  ['伟', 'wei'],
  ['静', 'jing'],
  ['敏', 'min'],
  ['磊', 'lei'],
  ['洋', 'yang'],
  ['艳', 'yan'],
  ['涛', 'tao'],
  ['超', 'chao'],
  ['霞', 'xia'],
  ['彬', 'bin'],
  ['琳', 'lin'],
  ['昊', 'hao'],
  ['悦', 'yue'],
];

export type DepartmentSpec = { key: DepartmentKey; size: number; roles: [RoleKey, number][] };

/** 部门规模合计 86 人；角色按部门职能加权 */
export const DEPARTMENTS: DepartmentSpec[] = [
  {
    key: 'ops1',
    size: 18,
    roles: [
      ['lead', 2],
      ['operator', 16],
    ],
  },
  {
    key: 'ops2',
    size: 16,
    roles: [
      ['lead', 2],
      ['operator', 14],
    ],
  },
  {
    key: 'ops3',
    size: 10,
    roles: [
      ['lead', 1],
      ['operator', 9],
    ],
  },
  {
    key: 'analytics',
    size: 12,
    roles: [
      ['analyst', 10],
      ['viewer', 2],
    ],
  },
  {
    key: 'platform',
    size: 16,
    roles: [
      ['admin', 3],
      ['operator', 5],
      ['analyst', 8],
    ],
  },
  {
    key: 'security',
    size: 6,
    roles: [
      ['admin', 1],
      ['analyst', 3],
      ['viewer', 2],
    ],
  },
  {
    key: 'support',
    size: 8,
    roles: [
      ['operator', 3],
      ['viewer', 5],
    ],
  },
];

/** 负责各大区的运维部门（工单派给对应部门的人） */
export const REGION_OWNER: Record<RegionKey, DepartmentKey> = {
  north: 'ops1',
  east: 'ops1',
  south: 'ops2',
  central: 'ops2',
  southwest: 'ops2',
  northwest: 'ops3',
  northeast: 'ops3',
};

/** 设备型号：监测频段（MHz）与占比 */
export const DEVICE_MODELS: { model: string; band: [number, number]; weight: number }[] = [
  { model: 'MX-200', band: [30, 1000], weight: 40 },
  { model: 'MX-300', band: [30, 3000], weight: 35 },
  { model: 'RX-500', band: [20, 6000], weight: 25 },
];

export const FIRMWARES = ['v3.2.1', 'v3.2.4', 'v3.3.0', 'v3.3.2'];

/** 设备名 */
export const deviceName = (city: City, seq: number, locale: 'zh-CN' | 'en-US') =>
  locale === 'en-US'
    ? `${city.en} Station ${String(seq).padStart(2, '0')}`
    : `${city.zh} ${String(seq).padStart(2, '0')} 号站`;

/** 工单标题模板：按告警类型 */
export const TICKET_TITLES: Record<string, { zh: string; en: string }> = {
  interference: { zh: '干扰源排查', en: 'Locate interference source' },
  signal: { zh: '信号异常复核', en: 'Verify abnormal signal' },
  link: { zh: '回传链路检修', en: 'Repair backhaul link' },
  offline: { zh: '设备离线恢复', en: 'Bring device back online' },
  power: { zh: '电源模块检查', en: 'Inspect power module' },
  temperature: { zh: '机柜散热处理', en: 'Fix cabinet cooling' },
  maintenance: { zh: '季度例行巡检', en: 'Quarterly routine inspection' },
};

/** 日程标题模板 */
export const EVENT_TITLES = {
  duty: { zh: '值班交接会', en: 'Shift handover' },
  inspection: { zh: '现场巡检', en: 'On-site inspection' },
  review: { zh: '故障复盘评审', en: 'Incident review' },
  training: { zh: '新员工设备培训', en: 'Device training for new hires' },
  maintenance: { zh: '夜间维护窗口', en: 'Night maintenance window' },
  release: { zh: '平台版本发布', en: 'Platform release' },
} as const;

/** 操作日志的客户端标识 */
export const USER_AGENTS = [
  'Chrome 140 · macOS',
  'Chrome 140 · Windows',
  'Edge 140 · Windows',
  'Safari 19 · macOS',
  'Firefox 143 · Windows',
];

/** 报表名称（操作日志「导出报表」的对象） */
export const REPORT_NAMES = [
  { zh: '设备在线率日报', en: 'Daily device uptime report' },
  { zh: '告警处置周报', en: 'Weekly alarm handling report' },
  { zh: '工单时限月报', en: 'Monthly ticket SLA report' },
  { zh: '频谱占用统计', en: 'Spectrum occupancy statistics' },
];

/** 角色名称（仅用于操作日志的对象文本；界面上的角色名走 i18n） */
export const ROLE_NAMES: Record<RoleKey, { zh: string; en: string }> = {
  admin: { zh: '系统管理员', en: 'Administrator' },
  lead: { zh: '值班长', en: 'Shift lead' },
  operator: { zh: '运维工程师', en: 'Operator' },
  analyst: { zh: '数据分析员', en: 'Analyst' },
  viewer: { zh: '访客', en: 'Viewer' },
};
