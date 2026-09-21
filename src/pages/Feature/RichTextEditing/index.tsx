import { ProCard } from '@ant-design/pro-components';
import { Editor } from '@tinymce/tinymce-react';
import { Button, Typography } from 'antd';
import { useRef, useState } from 'react';
import type { Editor as TinyMCEEditor } from 'tinymce';

export default () => {
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [content, setContent] = useState('');

  return (
    <ProCard className="shadow-2xl">
      <Editor
        apiKey={TINYMCE_API_KEY}
        onInit={(evt, editor) => (editorRef.current = editor)}
        initialValue="<p>This is the initial content of the editor.</p>"
        init={{
          height: 500,
          menubar: false,
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
            'code',
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
