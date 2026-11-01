/**
 * 固定演示场景（审查 D02/D03 的实现）：在自然分布之上追加一组稳定、可定位、可重置的业务记录。
 *
 * - 所有对象都是同一数据模型里的真实记录（Device/Alarm/Ticket/CalendarEvent），不是独立假面板；
 *   只是 ID 带 SCN 前缀、名称带「演示」标记，方便从列表、搜索与地图直接定位。
 * - 时间全部相对「现在」（或受控演示模式的锚点）生成：任意演示日进入场景都完整存在，不写死日期。
 * - 时间关系满足 创建 ≤ 响应 ≤ 完成 ≤ 验收；验收候选（未验收的已完成）与已验收互斥。
 * - 场景设备是新增的专用设备（不挪用自然分布的设备，主线设备因此只有设计中那一项阻断故障）。
 * - 机器可读清单见 SCENARIO_MANIFEST（docs/demo/demo-scenarios.json 由
 *   src/demo/manifest.test.ts 生成并校验一致，覆盖约束由 scenarios.test.ts 程序化校验）。
 */
import type { Alarm, CalendarEvent, Device, EventType, Ticket, User } from '@/services/types';
import { DEVICE_MODELS, REGION_OWNER, TICKET_TITLES } from './catalog';
import { DAY, HOUR, MINUTE, SLA_HOURS, type Dataset, type DemoLocale } from './generate';
import { SYNTHETIC_SIGNATURE_PNG } from './signatureSample';

const iso = (ms: number) => new Date(ms).toISOString();

/** 场景对象的稳定 ID（跨日、跨语言不变；文档、深链接与 e2e 引用它们） */
export const SCENARIO_IDS = {
  mainDevice: 'DEV-SCN-01',
  multiDevice: 'DEV-SCN-02',
  okDevice: 'DEV-SCN-03',
  mainAlarm: 'ALM-SCN-MAIN',
  multiAlarm1: 'ALM-SCN-MULTI-1',
  multiAlarm2: 'ALM-SCN-MULTI-2',
  historyAlarm: 'ALM-SCN-HIST',
  falsePositiveAlarm: 'ALM-SCN-FP',
  urgentAlarm: 'ALM-SCN-URGENT',
  urgentTicket: 'WO-SCN-URGENT',
  slaNearAlarm: 'ALM-SCN-SLA-NEAR',
  slaNear: 'WO-SCN-SLA-NEAR',
  slaOverAlarm: 'ALM-SCN-SLA-OVER',
  slaOver: 'WO-SCN-SLA-OVER',
  slaOkAlarm: 'ALM-SCN-SLA-OK',
  slaOk: 'WO-SCN-SLA-OK',
  slaLateAlarm: 'ALM-SCN-SLA-LATE',
  slaLate: 'WO-SCN-SLA-LATE',
  accept1Alarm: 'ALM-SCN-ACC-1',
  accept1: 'WO-SCN-ACC-1',
  accept2Alarm: 'ALM-SCN-ACC-2',
  accept2: 'WO-SCN-ACC-2',
  reworkAlarm: 'ALM-SCN-REWORK',
  reworkTicket: 'WO-SCN-REWORK',
  historyTicket: 'WO-SCN-HIST',
  maintenanceScheduled: 'WO-SCN-MT-1',
  maintenanceToday: 'WO-SCN-MT-2',
  maintenanceDoing: 'WO-SCN-MT-3',
  maintenanceDone: 'WO-SCN-MT-4',
  eventToday: 'EV-SCN-TODAY',
  eventTomorrow: 'EV-SCN-TOMORROW',
  eventAllDay: 'EV-SCN-ALLDAY',
  eventMultiDay: 'EV-SCN-MULTIDAY',
  eventCrossMonth: 'EV-SCN-CROSSMONTH',
} as const;

/** 五种角色的快捷体验账号（生成器把种子用户重命名为这些登录名；登录页一键体验） */
export const DEMO_ACCOUNTS = ['admin', 'lead', 'operator', 'analyst', 'guest'] as const;

/** 场景清单（机器可读）：每个场景的对象 ID、初始状态与可演示结果 */
export const SCENARIO_MANIFEST: {
  key: string;
  title: { zh: string; en: string };
  objects: string[];
  initialState: string;
  demonstrates: string;
}[] = [
  {
    key: 'mainline',
    title: { zh: '主线故障', en: 'Mainline fault' },
    objects: [SCENARIO_IDS.mainDevice, SCENARIO_IDS.mainAlarm],
    initialState: '离线设备 + 一条严重未转单的阻断告警（该设备唯一的阻断故障）',
    demonstrates: '转 P1 工单 → 处理 → 完成 → 验收 → 设备上线（在线 +1）且未恢复告警减一',
  },
  {
    key: 'multi-alarm',
    title: { zh: '多告警设备', en: 'Multi-alarm device' },
    objects: [SCENARIO_IDS.multiDevice, SCENARIO_IDS.multiAlarm1, SCENARIO_IDS.multiAlarm2],
    initialState: '同一设备两条未恢复阻断告警（电源·严重 / 温度·重要），设备故障',
    demonstrates: '只处理一条设备仍为故障，全部处理后才恢复在线',
  },
  {
    key: 'urgent',
    title: { zh: '紧急待办', en: 'Urgent todo' },
    objects: [SCENARIO_IDS.urgentAlarm, SCENARIO_IDS.urgentTicket],
    initialState: '一张未完成 P1（待处理，挂在自然分布设备上），不与主线待转单告警矛盾',
    demonstrates: '紧急优先级与看板排序',
  },
  {
    key: 'sla',
    title: { zh: '时限对比', en: 'SLA contrast' },
    objects: [
      SCENARIO_IDS.slaNearAlarm,
      SCENARIO_IDS.slaNear,
      SCENARIO_IDS.slaOverAlarm,
      SCENARIO_IDS.slaOver,
      SCENARIO_IDS.slaOkAlarm,
      SCENARIO_IDS.slaOk,
      SCENARIO_IDS.slaLateAlarm,
      SCENARIO_IDS.slaLate,
    ],
    initialState: '接近时限（P2 剩约 2h）/ 已逾期未完成（P1 超时约 3h）/ 时限内完成 / 逾期完成',
    demonstrates: 'SLA 提示、不同状态样式与统计口径',
  },
  {
    key: 'acceptance',
    title: { zh: '连续验收', en: 'Consecutive acceptance' },
    objects: [SCENARIO_IDS.accept1Alarm, SCENARIO_IDS.accept1, SCENARIO_IDS.accept2Alarm, SCENARIO_IDS.accept2],
    initialState: '两张彼此独立、已完成未验收的工单',
    demonstrates: '连续签字、自动选择有效下一单、签完空态',
  },
  {
    key: 'rework',
    title: { zh: '已验收与返工', en: 'Accepted & rework' },
    objects: [SCENARIO_IDS.reworkAlarm, SCENARIO_IDS.reworkTicket],
    initialState: '含合成签名验收的已完成工单（签字人为值班长演示账号）',
    demonstrates: '查看/导出签名 → 返工（旧验收归档失效）→ 重新完成 → 重新验收',
  },
  {
    key: 'history',
    title: { zh: '历史工单', en: 'Historical ticket' },
    objects: [SCENARIO_IDS.historyTicket, SCENARIO_IDS.historyAlarm],
    initialState: '完成超过三天、关联已恢复告警（看板近三天窗口之外）',
    demonstrates: '从告警链接或工单查询直接打开详情',
  },
  {
    key: 'false-positive',
    title: { zh: '误报关闭', en: 'False positive' },
    objects: [SCENARIO_IDS.falsePositiveAlarm],
    initialState: '在线设备上的活动告警（干扰·一般，不阻断可用性，设备保持在线）',
    demonstrates: '误报关闭、未恢复过滤中消失、日志与统计一致',
  },
  {
    key: 'maintenance',
    title: { zh: '例行巡检', en: 'Maintenance' },
    objects: [
      SCENARIO_IDS.maintenanceScheduled,
      SCENARIO_IDS.maintenanceToday,
      SCENARIO_IDS.maintenanceDoing,
      SCENARIO_IDS.maintenanceDone,
    ],
    initialState: '已排期（3 天后）/ 今日待开始 / 处理中 / 已完成 各一张',
    demonstrates: '与故障工单的文案、时限（14 天）和日程区分',
  },
  {
    key: 'normal',
    title: { zh: '正常设备', en: 'Normal device' },
    objects: [SCENARIO_IDS.okDevice],
    initialState: '无活动阻断故障的在线设备',
    demonstrates: '正常详情、正常地图点、合理空态',
  },
  {
    key: 'schedule',
    title: { zh: '日程', en: 'Schedule' },
    objects: [
      SCENARIO_IDS.eventToday,
      SCENARIO_IDS.eventTomorrow,
      SCENARIO_IDS.eventAllDay,
      SCENARIO_IDS.eventMultiDay,
      SCENARIO_IDS.eventCrossMonth,
    ],
    initialState:
      '下一场临时评审（最近的工作时段）/ 明早值班交接 / 后天全天 / 跨天 / 跨月（本月最后一天 → 下月第一天）',
    demonstrates: '新建/编辑/改期/详情/空态/未来列表',
  },
  {
    key: 'reports',
    title: { zh: '报表与导出', en: 'Reports & export' },
    objects: [SCENARIO_IDS.mainDevice, SCENARIO_IDS.mainAlarm],
    initialState: '聚合同源：KPI/地图/PDF/截图都从同一数据派生',
    demonstrates: 'PDF、截图与页面指标能对上当前状态',
  },
];

/** 运行期解析主线对象（设备/处理人随场景确定，规则确定） */
export const scenarioAnchor = (data: Dataset) => ({
  mainlineDeviceId: data.alarms.find((a) => a.id === SCENARIO_IDS.mainAlarm)!.deviceId,
  multiAlarmDeviceId: data.alarms.find((a) => a.id === SCENARIO_IDS.multiAlarm1)!.deviceId,
  handler: data.users.find((u) => u.username === 'operator')!,
  acceptor: data.users.find((u) => u.username === 'lead')!,
});

const zhOr = (locale: DemoLocale, zh: string, en: string) => (locale === 'en-US' ? en : zh);

const pickAssignee = (users: User[]): User => {
  const pool = users.filter(
    (u) => u.department === REGION_OWNER.north && (u.role === 'operator' || u.role === 'lead') && u.status === 'active',
  );
  return pool[0] ?? users[0]!;
};

/**
 * 把固定场景记录并入数据集（generate.ts 在自然分布生成后调用）。
 * 场景设备/告警满足 availability.ts 的派生规则：主线=离线、多告警=故障、正常=在线。
 */
export const applyScenarios = (data: Dataset, now: Date, locale: DemoLocale): void => {
  const nowMs = now.getTime();
  const assignee = pickAssignee(data.users);
  const acceptor = data.users.find((u) => u.role === 'lead' && u.status === 'active') ?? assignee;
  const spec = DEVICE_MODELS[0]!;
  const at = (offsetMs: number) => iso(nowMs + offsetMs);

  const city = zhOr(locale, '北京', 'Beijing');
  const device = (
    id: string,
    nameZh: string,
    nameEn: string,
    status: Device['status'],
    lng: number,
    lat: number,
  ): Device => ({
    id,
    name: zhOr(locale, nameZh, nameEn),
    region: 'north',
    city,
    lng,
    lat,
    coordinatePrecision: 'exact' as const,
    model: spec.model,
    band: spec.band,
    status,
    firmware: 'V2.3.1',
    installedAt: at(-400 * DAY),
    lastHeartbeatAt: at(status === 'online' ? -30 * 1000 : status === 'fault' ? -4 * MINUTE : -45 * MINUTE),
    uptime30d: status === 'online' ? 99.6 : status === 'fault' ? 94.1 : 88.3,
    signalDbm: status === 'online' ? -66 : -84,
  });

  const mainName = zhOr(locale, '演示 · 主线故障站', 'Demo · Mainline Fault Station');
  const multiName = zhOr(locale, '演示 · 多告警站', 'Demo · Multi-alarm Station');
  const okName = zhOr(locale, '演示 · 正常站', 'Demo · Normal Station');

  data.devices.push(
    device(SCENARIO_IDS.mainDevice, '演示 · 主线故障站', 'Demo · Mainline Fault Station', 'offline', 116.404, 39.915),
    device(SCENARIO_IDS.multiDevice, '演示 · 多告警站', 'Demo · Multi-alarm Station', 'fault', 116.362, 39.926),
    device(SCENARIO_IDS.okDevice, '演示 · 正常站', 'Demo · Normal Station', 'online', 116.308, 39.951),
  );

  const alarm = (
    id: string,
    deviceId: string,
    deviceName: string,
    level: Alarm['level'],
    type: Alarm['type'],
    occurredAgoMs: number,
    extra?: Partial<Alarm>,
  ): Alarm => ({
    id,
    deviceId,
    deviceName,
    region: 'north',
    city,
    level,
    type,
    source: 'auto',
    status: 'active',
    occurredAt: at(-occurredAgoMs),
    ...extra,
  });

  data.alarms.push(
    alarm(SCENARIO_IDS.mainAlarm, SCENARIO_IDS.mainDevice, mainName, 'critical', 'offline', 45 * MINUTE),
    alarm(SCENARIO_IDS.multiAlarm1, SCENARIO_IDS.multiDevice, multiName, 'critical', 'power', 3 * HOUR + 20 * MINUTE),
    alarm(SCENARIO_IDS.multiAlarm2, SCENARIO_IDS.multiDevice, multiName, 'major', 'temperature', 2 * HOUR),
    alarm(SCENARIO_IDS.historyAlarm, SCENARIO_IDS.okDevice, okName, 'major', 'link', 5 * DAY + 3 * HOUR, {
      status: 'ticketed',
      recoveredAt: at(-5 * DAY + HOUR),
      ticketId: SCENARIO_IDS.historyTicket,
    }),
    alarm(SCENARIO_IDS.falsePositiveAlarm, SCENARIO_IDS.okDevice, okName, 'minor', 'interference', 50 * MINUTE),
  );

  // 次级场景（紧急待办 / 时限对比）挂在自然分布的设备上：确定性挑选「北方大区、在线、当前无未恢复告警」的设备。
  // 这些场景告警一律用不阻断可用性的类型（signal）或已恢复状态，不改变自然分布的设备状态口径。
  const unresolvedDevices = new Set(
    data.alarms
      .filter((a) => !a.recoveredAt && a.status !== 'recovered' && a.status !== 'falsePositive')
      .map((a) => a.deviceId),
  );
  const spares = data.devices
    .filter((d) => d.region === 'north' && d.status === 'online' && !unresolvedDevices.has(d.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const spare = (index: number) => spares[index] ?? spares[spares.length - 1]!;
  const urgentDevice = spare(0);
  const slaNearDevice = spare(1);
  const slaOverDevice = spare(2);
  const paired = (
    id: string,
    device: Device,
    level: Alarm['level'],
    occurredAgoMs: number,
    ticketId: string,
    recoveredAgoMs?: number,
  ): Alarm =>
    alarm(id, device.id, device.name, level, 'signal', occurredAgoMs, {
      status: 'ticketed',
      ticketId,
      ...(recoveredAgoMs !== undefined ? { recoveredAt: at(-recoveredAgoMs) } : {}),
    });

  const ticket = (base: Omit<Ticket, 'assigneeId' | 'assigneeName'>): Ticket => ({
    ...base,
    assigneeId: assignee.id,
    assigneeName: assignee.name,
  });
  // 标题模板与自然生成、接口转单同源（catalog 的 TICKET_TITLES）：此前场景工单自带一套短标题
  // （「信号异常」「链路中断」「例行巡检」），与看板上其它工单（「信号异常复核」「回传链路检修」「季度例行巡检」）不一致
  const ticketTitle = (deviceName: string, key: keyof typeof TICKET_TITLES) =>
    `${deviceName} · ${TICKET_TITLES[key][locale === 'en-US' ? 'en' : 'zh']}`;

  // 次级场景的配对告警（与故障工单一一对应，保持「故障工单必有来源告警」的口径）
  data.alarms.push(
    paired(SCENARIO_IDS.urgentAlarm, urgentDevice, 'critical', 55 * MINUTE, SCENARIO_IDS.urgentTicket),
    paired(SCENARIO_IDS.slaNearAlarm, slaNearDevice, 'major', 10.5 * HOUR, SCENARIO_IDS.slaNear),
    paired(SCENARIO_IDS.slaOverAlarm, slaOverDevice, 'critical', 7.5 * HOUR, SCENARIO_IDS.slaOver),
    paired(
      SCENARIO_IDS.slaOkAlarm,
      data.devices.find((d) => d.id === SCENARIO_IDS.okDevice)!,
      'major',
      2 * DAY + 9 * HOUR,
      SCENARIO_IDS.slaOk,
      2 * DAY + 3 * HOUR,
    ),
    paired(
      SCENARIO_IDS.slaLateAlarm,
      data.devices.find((d) => d.id === SCENARIO_IDS.multiDevice)!,
      'major',
      3 * DAY + 3 * HOUR,
      SCENARIO_IDS.slaLate,
      3 * DAY - 18 * HOUR,
    ),
    paired(
      SCENARIO_IDS.accept1Alarm,
      data.devices.find((d) => d.id === SCENARIO_IDS.okDevice)!,
      'minor',
      9.5 * HOUR,
      SCENARIO_IDS.accept1,
      5 * HOUR,
    ),
    paired(
      SCENARIO_IDS.accept2Alarm,
      data.devices.find((d) => d.id === SCENARIO_IDS.multiDevice)!,
      'major',
      2 * DAY + 7 * HOUR,
      SCENARIO_IDS.accept2,
      26 * HOUR,
    ),
    paired(
      SCENARIO_IDS.reworkAlarm,
      data.devices.find((d) => d.id === SCENARIO_IDS.okDevice)!,
      'critical',
      27 * HOUR,
      SCENARIO_IDS.reworkTicket,
      23 * HOUR,
    ),
  );

  data.tickets.push(
    // 紧急待办：未完成 P1（挂在自然分布设备上，与主线待转单告警无关）
    ticket({
      id: SCENARIO_IDS.urgentTicket,
      title: ticketTitle(urgentDevice.name, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.urgentAlarm,
      deviceId: urgentDevice.id,
      deviceName: urgentDevice.name,
      city: urgentDevice.city,
      priority: 'P1',
      status: 'todo',
      createdAt: at(-50 * MINUTE),
      slaHours: SLA_HOURS.P1,
    }),
    // 时限对比四张
    ticket({
      id: SCENARIO_IDS.slaNear,
      title: ticketTitle(slaNearDevice.name, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.slaNearAlarm,
      deviceId: slaNearDevice.id,
      deviceName: slaNearDevice.name,
      city: slaNearDevice.city,
      priority: 'P2',
      status: 'doing',
      createdAt: at(-10 * HOUR),
      respondedAt: at(-9.5 * HOUR),
      slaHours: SLA_HOURS.P2,
    }),
    ticket({
      id: SCENARIO_IDS.slaOver,
      title: ticketTitle(slaOverDevice.name, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.slaOverAlarm,
      deviceId: slaOverDevice.id,
      deviceName: slaOverDevice.name,
      city: slaOverDevice.city,
      priority: 'P1',
      status: 'doing',
      createdAt: at(-7 * HOUR),
      respondedAt: at(-6.8 * HOUR),
      slaHours: SLA_HOURS.P1,
    }),
    ticket({
      id: SCENARIO_IDS.slaOk,
      title: ticketTitle(okName, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.slaOkAlarm,
      deviceId: SCENARIO_IDS.okDevice,
      deviceName: okName,
      city,
      priority: 'P2',
      status: 'done',
      createdAt: at(-2 * DAY - 8 * HOUR),
      respondedAt: at(-2 * DAY - 7.5 * HOUR),
      resolvedAt: at(-2 * DAY - 3 * HOUR),
      slaHours: SLA_HOURS.P2,
    }),
    ticket({
      id: SCENARIO_IDS.slaLate,
      title: ticketTitle(multiName, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.slaLateAlarm,
      deviceId: SCENARIO_IDS.multiDevice,
      deviceName: multiName,
      city,
      priority: 'P2',
      status: 'done',
      createdAt: at(-3 * DAY - 2 * HOUR),
      respondedAt: at(-3 * DAY - 1.5 * HOUR),
      resolvedAt: at(-3 * DAY + 18 * HOUR),
      slaHours: SLA_HOURS.P2,
    }),
    // 连续验收两张（彼此独立、已完成未验收）
    ticket({
      id: SCENARIO_IDS.accept1,
      title: ticketTitle(okName, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.accept1Alarm,
      deviceId: SCENARIO_IDS.okDevice,
      deviceName: okName,
      city,
      priority: 'P3',
      status: 'done',
      createdAt: at(-9 * HOUR),
      respondedAt: at(-8.5 * HOUR),
      resolvedAt: at(-5 * HOUR),
      slaHours: SLA_HOURS.P3,
    }),
    ticket({
      id: SCENARIO_IDS.accept2,
      title: ticketTitle(multiName, 'signal'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.accept2Alarm,
      deviceId: SCENARIO_IDS.multiDevice,
      deviceName: multiName,
      city,
      priority: 'P3',
      status: 'done',
      createdAt: at(-2 * DAY - 6 * HOUR),
      respondedAt: at(-2 * DAY - 5 * HOUR),
      resolvedAt: at(-26 * HOUR),
      slaHours: SLA_HOURS.P3,
    }),
    // 已验收样本（合成签名）：返工演示的起点
    {
      ...ticket({
        id: SCENARIO_IDS.reworkTicket,
        title: ticketTitle(okName, 'signal'),
        kind: 'fault',
        alarmId: SCENARIO_IDS.reworkAlarm,
        deviceId: SCENARIO_IDS.okDevice,
        deviceName: okName,
        city,
        priority: 'P2',
        status: 'done',
        createdAt: at(-26 * HOUR),
        respondedAt: at(-25.5 * HOUR),
        resolvedAt: at(-23 * HOUR),
        slaHours: SLA_HOURS.P2,
      }),
      acceptance: {
        signerName: acceptor.name,
        signedAt: at(-22 * HOUR),
        signature: SYNTHETIC_SIGNATURE_PNG,
      },
    },
    // 历史工单：完成超过三天（看板窗口之外），关联已恢复告警
    ticket({
      id: SCENARIO_IDS.historyTicket,
      title: ticketTitle(okName, 'link'),
      kind: 'fault',
      alarmId: SCENARIO_IDS.historyAlarm,
      deviceId: SCENARIO_IDS.okDevice,
      deviceName: okName,
      city,
      priority: 'P3',
      status: 'done',
      createdAt: at(-5 * DAY - 2.5 * HOUR),
      respondedAt: at(-5 * DAY - 2 * HOUR),
      resolvedAt: at(-5 * DAY + HOUR),
      slaHours: SLA_HOURS.P3,
    }),
    // 例行巡检四张：已排期 / 今日待开始 / 处理中 / 完成
    ticket({
      id: SCENARIO_IDS.maintenanceScheduled,
      title: ticketTitle(mainName, 'maintenance'),
      kind: 'maintenance',
      deviceId: SCENARIO_IDS.mainDevice,
      deviceName: mainName,
      city,
      priority: 'P3',
      status: 'todo',
      createdAt: at(-2 * DAY),
      scheduledAt: at(3 * DAY),
      slaHours: SLA_HOURS.maintenance,
    }),
    ticket({
      id: SCENARIO_IDS.maintenanceToday,
      title: ticketTitle(okName, 'maintenance'),
      kind: 'maintenance',
      deviceId: SCENARIO_IDS.okDevice,
      deviceName: okName,
      city,
      priority: 'P3',
      status: 'todo',
      createdAt: at(-3 * DAY),
      scheduledAt: at(4 * HOUR),
      slaHours: SLA_HOURS.maintenance,
    }),
    ticket({
      id: SCENARIO_IDS.maintenanceDoing,
      title: ticketTitle(multiName, 'maintenance'),
      kind: 'maintenance',
      deviceId: SCENARIO_IDS.multiDevice,
      deviceName: multiName,
      city,
      priority: 'P3',
      status: 'doing',
      createdAt: at(-4 * DAY),
      scheduledAt: at(-6 * HOUR),
      respondedAt: at(-6 * HOUR),
      slaHours: SLA_HOURS.maintenance,
    }),
    ticket({
      id: SCENARIO_IDS.maintenanceDone,
      title: ticketTitle(okName, 'maintenance'),
      kind: 'maintenance',
      deviceId: SCENARIO_IDS.okDevice,
      deviceName: okName,
      city,
      priority: 'P3',
      status: 'done',
      createdAt: at(-6 * DAY),
      scheduledAt: at(-2 * DAY - 4 * HOUR),
      respondedAt: at(-2 * DAY - 4 * HOUR),
      resolvedAt: at(-DAY - 8 * HOUR),
      slaHours: SLA_HOURS.maintenance,
    }),
  );

  // 日程：下一场临时评审 / 明早值班交接 / 后天全天 / 跨天 / 跨月（本月最后一天 → 下月第一天）。
  // 时刻落在日历的整点 / 半点与工作时段上：此前按「现在 + 偏移」计算，分钟随访问时刻漂移（11:11、04:32），
  // 「明日值班交接」落在明晚 19:30，「今日稍后评审」凌晨访问时排在 04:xx
  const onDay = (offsetDays: number, hour: number, minute = 0) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, hour, minute);
  /**
   * 最近一个开始前至少留 30 分钟的评审时段（每天 10:00 / 14:00 / 16:30），今天排满就顺延到明天；
   * 与已有日程同一开始时刻的时段跳过（隔周周四 14:00 有常规「故障复盘评审」）
   */
  const taken = new Set(data.events.filter((e) => !e.allDay).map((e) => e.start));
  const nextReviewSlot = () =>
    [0, 1]
      .flatMap((day) => [onDay(day, 10), onDay(day, 14), onDay(day, 16, 30)])
      .find((slot) => slot.getTime() >= nowMs + 30 * MINUTE && !taken.has(slot.toISOString()))!;
  const reviewStart = nextReviewSlot();
  const event = (
    id: string,
    type: EventType,
    titleZh: string,
    titleEn: string,
    start: Date,
    end?: Date,
    allDay = false,
  ): CalendarEvent => ({
    id,
    title: zhOr(locale, titleZh, titleEn),
    type,
    start: start.toISOString(),
    end: end?.toISOString(),
    allDay,
  });
  data.events.push(
    event(
      SCENARIO_IDS.eventToday,
      'review',
      '演示 · 临时复盘评审',
      'Demo · Ad-hoc incident review',
      reviewStart,
      new Date(reviewStart.getTime() + HOUR),
    ),
    event(
      SCENARIO_IDS.eventTomorrow,
      'duty',
      '演示 · 明日值班交接',
      'Demo · Duty handover tomorrow',
      // 与常规值班交接会同一时刻（周一 09:30）
      onDay(1, 9, 30),
      onDay(1, 10),
    ),
    event(
      SCENARIO_IDS.eventAllDay,
      'training',
      '演示 · 全天培训',
      'Demo · All-day training',
      onDay(2, 0),
      undefined,
      true,
    ),
    event(
      SCENARIO_IDS.eventMultiDay,
      'inspection',
      '演示 · 跨天巡检',
      'Demo · Multi-day inspection',
      onDay(2, 9),
      onDay(3, 18),
    ),
    event(
      SCENARIO_IDS.eventCrossMonth,
      'maintenance',
      '演示 · 跨月维护窗口',
      'Demo · Cross-month maintenance',
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 22),
      new Date(now.getFullYear(), now.getMonth() + 1, 1, 6),
    ),
  );

  // 场景记录按时间倒序归位（与生成器一致的呈现顺序）
  data.alarms.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  data.tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** 场景覆盖检查（scenarios.test.ts 等测试使用）：验证固定场景的存在性与关联约束 */
export const verifyScenarios = (dataset: Dataset, now: Date): string[] => {
  const problems: string[] = [];
  const deviceIds = new Set(dataset.devices.map((d) => d.id));
  const alarmIds = new Set(dataset.alarms.map((a) => a.id));
  const ticketIds = new Set(dataset.tickets.map((t) => t.id));
  const eventIds = new Set(dataset.events.map((e) => e.id));

  Object.values(SCENARIO_IDS).forEach((id) => {
    const pool = id.startsWith('DEV-')
      ? deviceIds
      : id.startsWith('ALM-')
        ? alarmIds
        : id.startsWith('WO-')
          ? ticketIds
          : eventIds;
    if (!pool.has(id)) problems.push(`missing object ${id}`);
  });

  const byId = <T extends { id: string }>(list: T[], id: string) => list.find((item) => item.id === id);
  const main = byId(dataset.alarms, SCENARIO_IDS.mainAlarm);
  if (main && (main.status !== 'active' || main.ticketId))
    problems.push('mainline alarm must start active and un-ticketed');
  const mainDevice = byId(dataset.devices, SCENARIO_IDS.mainDevice);
  const mainBlocking = dataset.alarms.filter(
    (a) => a.deviceId === SCENARIO_IDS.mainDevice && ['active', 'ticketed'].includes(a.status) && !a.recoveredAt,
  );
  if (mainDevice && mainBlocking.length !== 1)
    problems.push(`mainline device must have exactly one unrecovered blocking alarm, got ${mainBlocking.length}`);
  const hist = byId(dataset.alarms, SCENARIO_IDS.historyAlarm);
  if (hist?.ticketId !== SCENARIO_IDS.historyTicket) problems.push('history alarm must reference the history ticket');
  const histTicket = byId(dataset.tickets, SCENARIO_IDS.historyTicket);
  if (histTicket && now.getTime() - new Date(histTicket.resolvedAt ?? 0).getTime() < 3 * DAY) {
    problems.push('history ticket must be done more than 3 days before the demo clock');
  }
  const rework = byId(dataset.tickets, SCENARIO_IDS.reworkTicket);
  if (rework && !rework.acceptance?.signature)
    problems.push('rework ticket must carry a pre-seeded acceptance signature');
  // 验收可能缺席（上一条只记录 problem）：这里必须可空链，否则 verifyScenarios 自己先 TypeError
  if (
    rework?.acceptance?.signedAt &&
    new Date(rework.acceptance.signedAt).getTime() < new Date(rework.resolvedAt!).getTime()
  ) {
    problems.push('rework acceptance must be signed after resolution');
  }
  [SCENARIO_IDS.accept1, SCENARIO_IDS.accept2].forEach((id) => {
    const t = byId(dataset.tickets, id);
    if (t && (t.status !== 'done' || t.acceptance)) problems.push(`${id} must be done and unaccepted`);
  });
  dataset.tickets.forEach((t) => {
    if (t.alarmId && !alarmIds.has(t.alarmId)) problems.push(`ticket ${t.id} references missing alarm ${t.alarmId}`);
    if (!deviceIds.has(t.deviceId)) problems.push(`ticket ${t.id} references missing device ${t.deviceId}`);
    const times = [t.createdAt, t.respondedAt, t.resolvedAt, t.acceptance?.signedAt]
      .filter(Boolean)
      .map((v) => new Date(v!).getTime());
    if (times.some((v, i) => i > 0 && v < times[i - 1]))
      problems.push(`ticket ${t.id} violates created ≤ responded ≤ resolved ≤ accepted`);
  });
  return problems;
};
