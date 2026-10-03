import { formatDateTime } from '@/utils/format';
import { useIntl } from '@umijs/max';
import { Typography } from 'antd';

const REPO = 'https://github.com/Jerry-CodeHub/umi-react-admin';

/** 页脚：构建提交、时间与部署目标（与 dist/version.json 同源），一眼看出线上跑的是哪个版本 */
export default function BuildFooter() {
  const intl = useIntl();
  const { sha, time, target } = BUILD_INFO;
  const short = sha.slice(0, 7);
  return (
    <footer className="py-6 text-center text-xs">
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: 'footer.build' }, { time: formatDateTime(time, 'YYYY-MM-DD HH:mm'), target })}{' '}
        {sha === 'unknown' ? (
          short
        ) : (
          <Typography.Link href={`${REPO}/commit/${sha}`} target="_blank" rel="noopener noreferrer">
            {short}
          </Typography.Link>
        )}
      </Typography.Text>
    </footer>
  );
}
