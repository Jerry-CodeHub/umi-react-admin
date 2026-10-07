import DemoPage from '@/components/DemoPage';
import { PRIORITY_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { listTickets, signTicket } from '@/services/ops';
import type { Ticket } from '@/services/types';
import { formatDateTime } from '@/utils/format';
import {
  CheckOutlined,
  ClearOutlined,
  DownloadOutlined,
  EditOutlined,
  FormatPainterOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Result,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

const DAY = 86_400_000;
/** 留档图的笔迹色：不论界面明暗，存下来的签名一律白底深色字 */
const PAPER_INK = '#1f1f1f';

/**
 * 导出留档图：按笔迹的透明度重新着色成 PAPER_INK，再铺到白底上。
 * 暗色主题下画板是深底浅色笔迹（避免一整块白板刺眼），导出时统一成白纸黑字；橡皮擦过的地方是透明像素，同样正确。
 */
const exportSignature = (canvas: HTMLCanvasElement) => {
  const ink = document.createElement('canvas');
  ink.width = canvas.width;
  ink.height = canvas.height;
  const inkContext = ink.getContext('2d')!;
  inkContext.drawImage(canvas, 0, 0);
  inkContext.globalCompositeOperation = 'source-in';
  inkContext.fillStyle = PAPER_INK;
  inkContext.fillRect(0, 0, ink.width, ink.height);
  const paper = document.createElement('canvas');
  paper.width = canvas.width;
  paper.height = canvas.height;
  const context = paper.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, paper.width, paper.height);
  context.drawImage(ink, 0, 0);
  return paper.toDataURL('image/png');
};

/** 近 3 天完成、尚未验收签字的工单 */
const loadPending = async () => {
  const { list } = await listTickets({ status: 'done', pageSize: 200 });
  const since = Date.now() - 3 * DAY;
  return list.filter((ticket) => !ticket.acceptance && new Date(ticket.resolvedAt!).getTime() >= since);
};

export default function Signature() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const chart = useChartTheme();
  const penColor = chart.dark ? chart.token.colorText : PAPER_INK;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [ticketId, setTicketId] = useState<string>();
  const [signed, setSigned] = useState<Ticket>();
  const [saving, setSaving] = useState(false);
  const [empty, setEmpty] = useState(true);
  const { data: pending, loading, reload } = useApi(loadPending);
  const ticket = pending?.find((item) => item.id === ticketId);

  useEffect(() => {
    if (!ticketId && pending?.length) setTicketId(pending[0].id);
  }, [pending, ticketId]);

  // 画布按容器宽度与设备像素比重设分辨率（否则高分屏上笔迹模糊），尺寸变化时保留已有笔迹
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    // 透明底：画板底色由 CSS 按主题给出，导出时再铺白底（exportSignature）
    const pad = new SignaturePad(canvas, { penColor });
    padRef.current = pad;
    setEmpty(true);
    const syncEmpty = () => setEmpty(pad.isEmpty());
    pad.addEventListener('endStroke', syncEmpty);
    const resize = () => {
      const data = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      pad.removeEventListener('endStroke', syncEmpty);
      pad.off();
    };
    // penColor 的变化由下面的 effect 重新着色已有笔迹，不重建画板
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signed]);

  // 切换明暗主题：换笔色，并把已有笔迹重绘成新颜色
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.penColor = penColor;
    pad.fromData(pad.toData().map((group) => ({ ...group, penColor })));
  }, [penColor]);

  useEffect(() => {
    if (padRef.current) padRef.current.compositeOperation = tool === 'pen' ? 'source-over' : 'destination-out';
  }, [tool]);

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop();
    pad.fromData(data);
    setEmpty(pad.isEmpty());
  };

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const submit = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty() || !ticket) {
      message.warning(t('signature.empty'));
      return;
    }
    setSaving(true);
    try {
      setSigned(await signTicket(ticket.id, exportSignature(canvasRef.current!)));
      reload();
    } finally {
      setSaving(false);
    }
  };

  const download = () => {
    if (!signed?.acceptance) return;
    const link = document.createElement('a');
    link.href = signed.acceptance.signature;
    link.download = `${signed.id}-signature.png`;
    link.click();
  };

  return (
    <DemoPage descriptionId="page.signature.desc" source="src/pages/Components/Signature/index.tsx">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <Card title={t('signature.ticket')} loading={loading && !pending}>
            {pending?.length || signed ? (
              <>
                <Select
                  className="w-full"
                  value={ticketId}
                  placeholder={t('signature.ticketPlaceholder')}
                  onChange={(id) => {
                    setTicketId(id);
                    setSigned(undefined);
                  }}
                  options={(pending ?? []).map((item) => ({ value: item.id, label: `${item.id} · ${item.title}` }))}
                />
                {ticket && (
                  <Descriptions column={1} size="small" className="mt-4">
                    <Descriptions.Item label={t('screenshot.device')}>{ticket.deviceName}</Descriptions.Item>
                    <Descriptions.Item label={t('signature.assignee')}>{ticket.assigneeName}</Descriptions.Item>
                    <Descriptions.Item label={t('signature.completedAt')}>
                      {formatDateTime(ticket.resolvedAt!, 'YYYY-MM-DD HH:mm')}
                    </Descriptions.Item>
                    <Descriptions.Item label="SLA">
                      <Tag color={PRIORITY_COLOR[ticket.priority]}>{ticket.priority}</Tag>
                      {ticket.slaHours} h
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('signature.noTickets')} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={15}>
          <Card title={t('signature.pad')}>
            {signed?.acceptance ? (
              <Result
                status="success"
                title={t('signature.done', { ticket: signed.id })}
                subTitle={t('signature.signedBy', {
                  name: signed.acceptance.signerName,
                  time: formatDateTime(signed.acceptance.signedAt, 'YYYY-MM-DD HH:mm'),
                })}
                extra={[
                  <img
                    key="img"
                    src={signed.acceptance.signature}
                    alt={t('signature.pad')}
                    className="mx-auto mb-4 block max-h-40 rounded border bg-white"
                  />,
                  <Button key="download" icon={<DownloadOutlined />} onClick={download}>
                    {t('signature.download')}
                  </Button>,
                  <Button key="next" type="primary" onClick={() => setSigned(undefined)} disabled={!pending?.length}>
                    {t('signature.ticketPlaceholder')}
                  </Button>,
                ]}
              />
            ) : (
              <>
                {/* 画板随主题（暗色下不再是一整块白板）；签名线与提示是 DOM 浮层，不会进入导出的图片 */}
                <div className="relative aspect-[2/1] w-full max-w-3xl select-none">
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full touch-none rounded-lg border border-solid"
                    style={{ borderColor: chart.token.colorBorder, background: chart.token.colorFillQuaternary }}
                  />
                  <div
                    className="pointer-events-none absolute border-0 border-b border-dashed"
                    style={{ left: '8%', right: '8%', bottom: '26%', borderColor: chart.token.colorBorder }}
                  >
                    {empty && (
                      <Typography.Text type="secondary" className="absolute bottom-2 left-0">
                        × {t('signature.placeholder')}
                      </Typography.Text>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Space wrap>
                    <Segmented
                      value={tool}
                      onChange={(value) => setTool(value as 'pen' | 'eraser')}
                      options={[
                        { value: 'pen', icon: <EditOutlined />, label: t('signature.pen') },
                        { value: 'eraser', icon: <FormatPainterOutlined />, label: t('signature.eraser') },
                      ]}
                    />
                    <Button icon={<UndoOutlined />} onClick={undo}>
                      {t('signature.undo')}
                    </Button>
                    <Button icon={<ClearOutlined />} onClick={clear}>
                      {t('signature.clear')}
                    </Button>
                  </Space>
                  <Button type="primary" icon={<CheckOutlined />} loading={saving} disabled={!ticket} onClick={submit}>
                    {t('signature.submit')}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </DemoPage>
  );
}
