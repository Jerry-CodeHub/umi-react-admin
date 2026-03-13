import { ITreeNode, TreeNode } from '@pind/designable-core';
import { transformToSchema, transformToTreeNode } from '@pind/designable-formily-transformer';
import { MonacoInput } from '@pind/designable-react-settings-form';
import React from 'react';

export interface ISchemaEditorWidgetProps {
  tree: TreeNode;
  onChange?: (tree: ITreeNode) => void;
}

export const SchemaEditorWidget: React.FC<ISchemaEditorWidgetProps> = (props) => {
  return (
    <MonacoInput
      {...props}
      value={JSON.stringify(transformToSchema(props.tree), null, 2)}
      onChange={(value) => {
        try {
          props.onChange?.(transformToTreeNode(JSON.parse(value)));
        } catch (e) {
          console.error('[SchemaEditor] Invalid JSON:', e);
        }
      }}
      language="json"
    />
  );
};
