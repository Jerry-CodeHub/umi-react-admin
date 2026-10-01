import DemoPage from '@/components/DemoPage';
import { PRIORITY_COLOR } from '@/constants/semantic';
import { useApi } from '@/hooks/useApi';
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
import { App, Button, Card, Col, Descriptions, Empty, Result, Row, Segmented, Select, Space, Tag } from 'antd';
import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';

const DAY = 86_400_000;

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [ticketId, setTicketId] = useState<string>();
  const [signed, setSigned] = useState<Ticket>();
  const [saving, setSaving] = useState(false);
  const { data: pending, loading, reload } = useApi(loadPending);
  const ticket = pending?.find((item) => item.id === ticketId);

  useEffect(() => {
    if (!ticketId && pending?.length) setTicketId(pending[0].id);
  }, [pending, ticketId]);

  // 画布按容器宽度与设备像素比重设分辨率（否则高分屏上笔迹模糊），尺寸变化时保留已有笔迹
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)', penColor: '#1f1f1f' });
    padRef.current = pad;
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
      pad.off();
    };
  }, [signed]);

  useEffect(() => {
    if (padRef.current) padRef.current.compositeOperation = tool === 'pen' ? 'source-over' : 'destination-out';
  }, [tool]);

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop();
    pad.fromData(data);
  };

  const submit = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty() || !ticket) {
      message.warning(t('signature.empty'));
      return;
    }
    setSaving(true);
    try {
      setSigned(await signTicket(ticket.id, pad.toDataURL('image/png')));
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
                {/* 签名板保持白底：签字留档通常是白纸黑字，暗色主题下也不反色 */}
                <div className="relative aspect-[2/1] w-full max-w-3xl select-none">
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 h-full w-full touch-none rounded-lg border border-solid"
                    style={{ borderColor: 'rgba(0,0,0,0.12)', background: '#fff' }}
                  />
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
                    <Button icon={<ClearOutlined />} onClick={() => padRef.current?.clear()}>
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
