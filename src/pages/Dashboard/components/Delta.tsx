import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { theme } from 'antd';

type DeltaProps = {
  /** 变化量（已按展示单位换算好） */
  value: number;
  /** 展示文本（例如「21%」「3.1 个百分点」） */
  text: string;
  /** 上升是好事还是坏事：决定红绿（告警、响应时长上升是坏事） */
  higherIsBetter: boolean;
  label: string;
};

/** 环比变化：箭头 + 数值 + 说明，按「好 / 坏」而不是「涨 / 跌」着色 */
export default function Delta({ value, text, higherIsBetter, label }: DeltaProps) {
  const intl = useIntl();
  const { token } = theme.useToken();
  if (Math.abs(value) < 1e-9) {
    return (
      <span style={{ color: token.colorTextSecondary }}>
        {label} {intl.formatMessage({ id: 'dashboard.kpi.unchanged' })}
      </span>
    );
  }
  const good = value > 0 === higherIsBetter;
  const color = good ? token.colorSuccess : token.colorError;
  return (
    <span style={{ color: token.colorTextSecondary }}>
      {label}{' '}
      <span style={{ color, whiteSpace: 'nowrap' }}>
        {value > 0 ? <CaretUpOutlined /> : <CaretDownOutlined />} {text}
      </span>
    </span>
  );
}
