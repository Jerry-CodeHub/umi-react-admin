import DemoPage from '@/components/DemoPage';
import { useApi } from '@/hooks/useApi';
import { useChartTheme } from '@/hooks/useChartTheme';
import { listEvents } from '@/services/events';
import { getDashboardOverview } from '@/services/ops';
import { EyeOutlined } from '@ant-design/icons';
import { Editor } from '@tinymce/tinymce-react';
import { useIntl } from '@umijs/max';
import { Button, Card, Skeleton, Typography } from 'antd';
import DOMPurify from 'dompurify';
import { useRef, useState } from 'react';
import type { Editor as TinyMCEEditor } from 'tinymce';
import { buildWeeklyReport } from './report';
// 自托管 TinyMCE（必须先于编辑器渲染执行，挂载全局 tinymce 后 Editor 不再走 Tiny Cloud）
import './tinymceBundle';

const DAY = 86_400_000;

/** 周报初稿需要的数据：工作台汇总 + 未来 7 天的巡检排期 */
const loadDraft = async () => {
  const now = Date.now();
  const [overview, events] = await Promise.all([
    getDashboardOverview(),
    listEvents(new Date(now).toISOString(), new Date(now + 7 * DAY).toISOString()),
  ]);
  return { overview, plans: events.filter((event) => event.type === 'inspection').slice(0, 5) };
};

export default function RichText() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { dark } = useChartTheme();
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [preview, setPreview] = useState('');
  const { data } = useApi(loadDraft);

  // 皮肤只能在初始化时指定：切换主题时按 key 重建编辑器。重建前（本次渲染、旧编辑器尚未卸载）
  // 直接从旧实例取最新内容作为新编辑器的初始值——不依赖 change/keyup 事件是否已触发
  const draftRef = useRef<string | undefined>(undefined);
  const renderedDarkRef = useRef(dark);
  if (data && draftRef.current === undefined) {
    draftRef.current = buildWeeklyReport(data.overview, data.plans, t, intl.locale);
  }
  if (renderedDarkRef.current !== dark) {
    draftRef.current = editorRef.current?.getContent() ?? draftRef.current;
    renderedDarkRef.current = dark;
  }

  return (
    <DemoPage
      descriptionId="page.richText.desc"
      source="src/pages/Components/RichText/report.ts"
      extra={
        <Button
          icon={<EyeOutlined />}
          onClick={() => {
            // 消毒后再注入（审计 2026-09-22 M-7）：本页内容来自页内编辑器自身（self-XSS），
            // 但这是模板最易被复制的模式——下游接「存库再回显」时，这里的 DOMPurify 就是存储型 XSS 的防线
            if (editorRef.current) setPreview(DOMPurify.sanitize(editorRef.current.getContent()));
          }}
        >
          {t('richText.preview')}
        </Button>
      }
    >
      <Card>
        <Skeleton active loading={!draftRef.current} paragraph={{ rows: 12 }}>
          <Editor
            key={`${dark ? 'dark' : 'light'}-${intl.locale}`}
            licenseKey="gpl"
            onInit={(_evt, editor) => (editorRef.current = editor)}
            initialValue={draftRef.current}
            init={{
              height: 560,
              menubar: false,
              skin: dark ? 'oxide-dark' : 'oxide',
              content_css: dark ? 'dark' : 'default',
              plugins: ['advlist', 'autolink', 'lists', 'link', 'table', 'charmap', 'searchreplace', 'wordcount'],
              toolbar:
                'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright | ' +
                'bullist numlist outdent indent | table link | removeformat',
              // 段落格式下拉跟随界面语言（没有打包 TinyMCE 语言包，工具栏其余部分是图标）
              block_formats: t('richText.blockFormats'),
              // 正文限宽居中，像一页文档：满宽的长行不好读
              content_style:
                'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.7; max-width: 800px; margin: 16px auto; padding: 0 16px }',
            }}
          />
        </Skeleton>
      </Card>
      {preview && (
        <Card className="mt-4" title={t('richText.previewTitle')}>
          {/* 回显内容已经 DOMPurify 消毒（见上方预览按钮），此注入点安全 */}
          <Typography>
            <div dangerouslySetInnerHTML={{ __html: preview }} />
          </Typography>
        </Card>
      )}
    </DemoPage>
  );
}
