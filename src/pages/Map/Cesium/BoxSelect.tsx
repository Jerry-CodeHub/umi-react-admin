import { CesiumStage, useCesiumViewer } from '@/components/CesiumViewer';
import { addStationPoints, pickLngLat, STATUS_CSS } from '@/components/CesiumViewer/stations';
import DemoPage from '@/components/DemoPage';
import { DEVICE_STATUS_KEYS } from '@/constants/enums';
import { useApi } from '@/hooks/useApi';
import { useEnums } from '@/hooks/useEnums';
import { listAllDevices } from '@/services/ops';
import type { Device } from '@/services/types';
import { distanceKm } from '@/utils/MapCompute/geodesy';
import { BorderOutlined, ClearOutlined, ColumnWidthOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Alert, Badge, Button, Card, List, Space, Typography } from 'antd';
import * as Cesium from 'cesium';
import { useEffect, useRef, useState } from 'react';

type Tool = 'box' | 'measure';

export default function BoxSelect() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const enums = useEnums();
  const { data: devices } = useApi(listAllDevices);
  const [tool, setTool] = useState<Tool>();
  const [selected, setSelected] = useState<Device[]>();
  const [distance, setDistance] = useState<number>();
  const toolRef = useRef<Tool>(undefined);
  const clicksRef = useRef<[number, number][]>([]);
  const devicesRef = useRef<Device[]>([]);
  const layerRef = useRef<Cesium.CustomDataSource>(null);
  devicesRef.current = devices ?? [];
  toolRef.current = tool;

  const { containerRef, viewer, error } = useCesiumViewer({
    onReady: (instance) => {
      const layer = new Cesium.CustomDataSource('select');
      instance.dataSources.add(layer);
      layerRef.current = layer;
      const handler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas);
      handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
        const active = toolRef.current;
        const lngLat = active && pickLngLat(instance, click.position);
        if (!active || !lngLat) return;
        clicksRef.current.push(lngLat);
        layer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(...lngLat),
          point: { pixelSize: 8, color: Cesium.Color.YELLOW },
        });
        if (clicksRef.current.length < 2) return;

        const [a, b] = clicksRef.current;
        if (active === 'box') {
          const rect = Cesium.Rectangle.fromDegrees(
            Math.min(a[0], b[0]),
            Math.min(a[1], b[1]),
            Math.max(a[0], b[0]),
            Math.max(a[1], b[1]),
          );
          layer.entities.add({
            rectangle: {
              coordinates: rect,
              material: Cesium.Color.YELLOW.withAlpha(0.15),
              outline: true,
              outlineColor: Cesium.Color.YELLOW,
            },
          });
          setSelected(
            devicesRef.current.filter((d) =>
              Cesium.Rectangle.contains(rect, Cesium.Cartographic.fromDegrees(d.lng, d.lat)),
            ),
          );
        } else {
          layer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray([...a, ...b]),
              width: 3,
              material: Cesium.Color.YELLOW,
              clampToGround: true,
            },
          });
          setDistance(distanceKm(a, b));
        }
        clicksRef.current = [];
        setTool(undefined);
        (instance.container as HTMLElement).style.cursor = '';
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => handler.destroy();
    },
  });

  useEffect(() => {
    if (!viewer || !devices) return undefined;
    const points = addStationPoints(viewer, devices);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.primitives.remove(points);
    };
  }, [viewer, devices]);

  const start = (next: Tool) => {
    layerRef.current?.entities.removeAll();
    clicksRef.current = [];
    setSelected(undefined);
    setDistance(undefined);
    setTool(next);
    (viewer!.container as HTMLElement).style.cursor = 'crosshair';
  };

  const clear = () => {
    layerRef.current?.entities.removeAll();
    clicksRef.current = [];
    setSelected(undefined);
    setDistance(undefined);
    setTool(undefined);
  };

  const legend = (
    <Card size="small" className="opacity-95">
      <Space direction="vertical" size={2}>
        {DEVICE_STATUS_KEYS.map((status) => (
          <Badge key={status} color={STATUS_CSS[status]} text={enums.label('deviceStatus', status)} />
        ))}
      </Space>
    </Card>
  );

  const hint =
    tool === 'box'
      ? t('cesium.select.boxHint')
      : tool === 'measure'
        ? t('cesium.select.measureHint')
        : selected
          ? t('cesium.select.result', {
              count: selected.length,
              online: selected.filter((d) => d.status === 'online').length,
            })
          : distance !== undefined
            ? t('cesium.select.distance', { distance: distance.toFixed(1) })
            : t('map.stations', { count: devices?.length ?? 0 });

  return (
    <DemoPage
      descriptionId="page.cesium.select.desc"
      source="src/pages/Map/Cesium/BoxSelect.tsx"
      extra={
        <>
          <Button
            type={tool === 'box' ? 'primary' : 'default'}
            icon={<BorderOutlined />}
            disabled={!viewer || !devices}
            onClick={() => start('box')}
          >
            {t('cesium.select.box')}
          </Button>
          <Button
            type={tool === 'measure' ? 'primary' : 'default'}
            icon={<ColumnWidthOutlined />}
            disabled={!viewer}
            onClick={() => start('measure')}
          >
            {t('cesium.select.measure')}
          </Button>
          <Button icon={<ClearOutlined />} onClick={clear}>
            {t('map.clear')}
          </Button>
        </>
      }
    >
      <Alert type={tool ? 'warning' : 'info'} showIcon className="mb-4" message={hint} />
      <div className="flex flex-col gap-4 xl:flex-row">
        <Card className="min-w-0 flex-1" styles={{ body: { padding: 0 } }}>
          <CesiumStage containerRef={containerRef} viewer={viewer} error={error} overlay={legend} />
        </Card>
        {selected && selected.length > 0 && (
          <Card size="small" className="xl:w-72" styles={{ body: { maxHeight: 560, overflowY: 'auto' } }}>
            <List
              size="small"
              dataSource={selected}
              renderItem={(device) => (
                <List.Item className="px-0!">
                  <Badge color={STATUS_CSS[device.status]} text={device.name} />
                  <Typography.Text type="secondary" className="text-xs">
                    {device.uptime30d}%
                  </Typography.Text>
                </List.Item>
              )}
            />
          </Card>
        )}
      </div>
    </DemoPage>
  );
}
