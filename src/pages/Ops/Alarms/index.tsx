import DemoPage from '@/components/DemoPage';
import SemanticTag from '@/components/SemanticTag';
import { ALARM_LEVEL_KEYS, ALARM_STATUS_KEYS, ALARM_TYPE_KEYS, REGION_KEYS } from '@/constants/enums';
import { LEVEL_COLOR } from '@/constants/semantic';
import { useEnums } from '@/hooks/useEnums';
import { useResponsiveTable } from '@/hooks/useResponsiveTable';
import { handleAlarm, listAlarms } from '@/services/ops';
import type { Alarm, AlarmHandleAction } from '@/services/types';
import { humanizeDuration } from '@/utils/duration';
import { formatDateTime, fromNow } from '@/utils/format';
import { nowMs } from '@/utils/now';
import { DownOutlined } from '@ant-design/icons';
import { ProTable, type ActionType, type ProColumns, type ProFormInstance } from '@ant-design/pro-components';
import { Link, useAccess, useIntl, useLocation } from '@umijs/max';
import { App, Badge, Button, Dropdown, Switch, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';

const ACTIONS: AlarmHandleAction[] = ['ticket', 'recover', 'falsePositive'];

/** 业务恢复语义（与演示后端一致）：ticketed 且无恢复时间 = 仍未恢复 */
const alarmRecovered = (alarm: Alarm) =>
  alarm.status === 'recovered' || alarm.status === 'falsePositive' || !!alarm.recoveredAt;

export default function Alarms() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const table = useResponsiveTable();
  const { message, modal } = App.useApp();
  const access = useAccess();
  const location = useLocation();
  const actionRef = useRef<ActionType>(undefined);
  const formRef = useRef<ProFormInstance>(undefined);
  // 深链接可带初始筛选（工作台动态/演示脚本跳转）：?keyword=ALM-…&unrecovered=1。
  // 用 useMemo 跟随 location.search：同路由跳转（只变 query）不会重挂载组件，也要能生效
  const urlQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [activeOnly, setActiveOnly] = useState(
    () => new URLSearchParams(window.location.search).get('unrecovered') === '1',
  );
  const canHandle = access.permission('ops.alarm.handle');

  useEffect(() => {
    const keyword = urlQuery.get('keyword');
    if (!keyword) return undefined;
    // actionRef.reload() 只会沿用上一次提交的参数（不吃表单当前值），要走一次真正的提交才能
    // 把关键字带上。formRef 在 ProTable 挂载后才可用：轮询到它就绪再填值提交（不依赖固定延时）
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (formRef.current) {
        formRef.current.setFieldsValue({ keyword });
        formRef.current.submit();
        clearInterval(timer);
      } else if (tries > 50) {
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [urlQuery]);

  const handle = async (alarm: Alarm, action: AlarmHandleAction) => {
    await handleAlarm(alarm.id, action);
    message.success(t('alarms.handled'));
    actionRef.current?.reload();
  };

  /** 误报关闭会让告警直接离开「未恢复」池、不派生工单，先确认；转工单 / 标记恢复是常规处置，直接执行 */
  const confirmAndHandle = (alarm: Alarm, action: AlarmHandleAction) => {
    // 失败提示由请求层 toast，这里接住 rejection 避免 fire-and-forget 的 unhandled rejection
    if (action !== 'falsePositive') {
      void handle(alarm, action).catch(() => undefined);
      return;
    }
    modal.confirm({
      title: t('alarms.falsePositiveConfirm', { id: alarm.id }),
      content: t('alarms.falsePositiveConfirmDesc'),
      okButtonProps: { danger: true },
      onOk: () => handle(alarm, action).catch(() => undefined),
    });
  };

  const columns: ProColumns<Alarm>[] = [
    {
      title: t('users.keyword'),
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: t('alarms.keywordPlaceholder') },
    },
    {
      title: t('alarms.column.level'),
      dataIndex: 'level',
      width: 90,
      valueEnum: enums.valueEnum('alarmLevel', ALARM_LEVEL_KEYS),
      render: (_, alarm) => (
        <SemanticTag tone={LEVEL_COLOR[alarm.level]}>{enums.label('alarmLevel', alarm.level)}</SemanticTag>
      ),
    },
    {
      title: t('alarms.column.type'),
      dataIndex: 'type',
      width: 110,
      valueEnum: enums.valueEnum('alarmType', ALARM_TYPE_KEYS),
    },
    {
      title: t('alarms.column.device'),
      dataIndex: 'deviceName',
      search: false,
      width: 190,
      render: (_, alarm) => (
        <div>
          <div>{alarm.deviceName}</div>
          <Typography.Text type="secondary" className="text-xs">
            {alarm.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: t('alarms.column.location'),
      dataIndex: 'region',
      width: 130,
      valueEnum: enums.valueEnum('region', REGION_KEYS),
      render: (_, alarm) => `${enums.label('region', alarm.region)} · ${alarm.city}`,
    },
    {
      title: t('alarms.column.occurredAt'),
      dataIndex: 'occurredAt',
      valueType: 'dateTimeRange',
      width: 140,
      search: { transform: ([from, to]: [string, string]) => ({ from, to }) },
      render: (_, alarm) => (
        <Tooltip title={fromNow(alarm.occurredAt, intl.locale)}>
          {formatDateTime(alarm.occurredAt, 'MM-DD HH:mm:ss')}
        </Tooltip>
      ),
    },
    {
      title: t('alarms.column.duration'),
      dataIndex: 'recoveredAt',
      search: false,
      width: 130,
      render: (_, alarm) => {
        // 受控演示模式下用演示时钟算「持续中」时长（与「演示时间」口径一致）
        const end = alarm.recoveredAt ? new Date(alarm.recoveredAt).getTime() : nowMs();
        const text = humanizeDuration(end - new Date(alarm.occurredAt).getTime(), t);
        return alarmRecovered(alarm) ? (
          text
        ) : (
          <Typography.Text type="warning">{t('alarms.ongoing', { duration: text })}</Typography.Text>
        );
      },
    },
    {
      title: t('alarms.column.status'),
      dataIndex: 'status',
      width: 130,
      valueEnum: enums.valueEnum('alarmStatus', ALARM_STATUS_KEYS, (key) => ({
        status: { active: 'Error', recovered: 'Success', ticketed: 'Processing', falsePositive: 'Default' }[key],
      })),
      render: (dom, alarm) =>
        alarm.ticketId ? (
          <div>
            {/* 已随工单恢复的转单告警按恢复语义展示，未恢复的仍算「未恢复」池的一部分（F08）。
                与同列 valueEnum 渲染的「已恢复」同一形态（状态点 + 文字），不再一列里混用点与标签两种样式 */}
            {alarmRecovered(alarm) && alarm.status === 'ticketed' ? (
              <Badge status="success" text={enums.label('alarmStatus', 'recovered')} />
            ) : (
              dom
            )}
            {/* 工单深链接：携带 ID 直接打开对应工单（F03），含超出看板窗口的历史工单 */}
            <Link to={`/ops/tickets?focus=${encodeURIComponent(alarm.ticketId)}`} className="block text-xs">
              {alarm.ticketId}
            </Link>
          </div>
        ) : (
          dom
        ),
    },
    {
      title: t('alarms.column.source'),
      dataIndex: 'source',
      search: false,
      width: 100,
      responsive: ['xxl'],
      render: (_, alarm) => enums.label('alarmSource', alarm.source),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 110,
      fixed: table.fixedRight,
      render: (_, alarm) =>
        alarm.status === 'active' && canHandle ? (
          // 点击展开（与顶栏菜单一致）：悬停展开在逐行扫视表格时容易误弹
          <Dropdown
            trigger={['click']}
            menu={{
              items: ACTIONS.map((action) => ({
                key: action,
                label: t(`alarms.handle.${action}`),
                danger: action === 'falsePositive',
              })),
              onClick: ({ key }) => confirmAndHandle(alarm, key as AlarmHandleAction),
            }}
          >
            <Button type="link" size="small">
              {t('alarms.handle')} <DownOutlined />
            </Button>
          </Dropdown>
        ) : null,
    },
  ];

  return (
    <DemoPage descriptionId="page.alarms.desc" source="src/pages/Ops/Alarms/index.tsx">
      <ProTable<Alarm>
        rowKey="id"
        actionRef={actionRef}
        formRef={formRef}
        columns={columns}
        scroll={table.scroll}
        search={{ labelWidth: 'auto' }}
        params={{ activeOnly }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <label key="active" className="flex items-center gap-2">
            {/* 开关外侧的文字不会成为按钮的可访问名（axe button-name，critical）：button 属于 label 元素，
                用 <label> 包裹即可建立隐式关联（antd 6 的 SwitchProps 不接受 aria-label，这也顺带让点文字可切换） */}
            <Switch size="small" checked={activeOnly} onChange={setActiveOnly} />
            {t('alarms.activeOnly')}
          </label>,
        ]}
        request={async ({ activeOnly: onlyActive, ...params }) => {
          // 只看未恢复 = 按业务恢复语义筛选（活动 + 已转工单但未恢复），不是只看 active（F08）
          const page = await listAlarms({ ...params, unrecovered: onlyActive ? true : undefined });
          return { data: page.list, total: page.total, success: true };
        }}
      />
    </DemoPage>
  );
}
