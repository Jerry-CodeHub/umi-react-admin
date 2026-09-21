import { ProCard } from '@ant-design/pro-components';
import { Editor } from '@tinymce/tinymce-react';
import { useModel } from '@umijs/max';
import { Button, Typography } from 'antd';
import { useRef, useState } from 'react';
import type { Editor as TinyMCEEditor } from 'tinymce';
// 自托管 TinyMCE（必须先于编辑器渲染执行，挂载全局 tinymce 后 Editor 不再走 Tiny Cloud）
import './tinymceBundle';

const INITIAL_CONTENT = '<p>This is the initial content of the editor.</p>';

export default () => {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  // 皮肤只能在初始化时指定：切换主题时按 key 重建编辑器，用 ref 保留已编辑的内容
  const draftRef = useRef(INITIAL_CONTENT);
  const [content, setContent] = useState('');
  const { initialState } = useModel('@@initialState');
  const dark = initialState?.theme === 'realDark';

  return (
    <ProCard className="shadow-2xl">
      <Editor
        key={dark ? 'dark' : 'light'}
        licenseKey="gpl"
        onInit={(_evt, editor) => (editorRef.current = editor)}
        onEditorChange={(value) => {
          draftRef.current = value;
        }}
        initialValue={draftRef.current}
        init={{
          height: 500,
          menubar: false,
          skin: dark ? 'oxide-dark' : 'oxide',
          content_css: dark ? 'dark' : 'default',
          plugins: [
            'advlist',
            'autolink',
            'lists',
            'link',
            'image',
            'charmap',
            'preview',
            'anchor',
            'searchreplace',
            'visualblocks',
            'fullscreen',
            'insertdatetime',
            'media',
            'table',
            'help',
            'wordcount',
          ],
          toolbar:
            'undo redo | blocks | ' +
            'bold italic forecolor | alignleft aligncenter ' +
            'alignright alignjustify | bullist numlist outdent indent | ' +
            'removeformat | help',
          content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
        }}
      />
      <Button
        className="mt-4"
        onClick={() => {
          // 编辑器内容回显到页面（此前仅 console.warn 输出，用户无感知）
          if (editorRef.current) {
            setContent(editorRef.current.getContent());
          }
        }}
      >
        预览内容
      </Button>
      {content && (
        <div className="mt-4">
          <Typography.Title level={5}>内容回显</Typography.Title>
          {/* 演示页：内容来自页面内编辑器自身（非外部输入），回显直出 */}
          <div className="rounded-md border border-gray-200 p-4" dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      )}
    </ProCard>
  );
};
