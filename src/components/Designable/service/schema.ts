import { Engine } from '@pind/designable-core';
import { transformToSchema, transformToTreeNode } from '@pind/designable-formily-transformer';
import { message } from 'antd';

export const saveSchema = (designer: Engine) => {
  const tree = designer.getCurrentTree();
  if (!tree) return;
  localStorage.setItem('formily-schema', JSON.stringify(transformToSchema(tree)));
  message.success('Save Success');
};

export const loadInitialSchema = (designer: Engine) => {
  try {
    const raw = localStorage.getItem('formily-schema');
    if (!raw) return;
    designer.setCurrentTree(transformToTreeNode(JSON.parse(raw)));
  } catch (e) {
    console.error('[Designable] Failed to load schema from localStorage:', e);
  }
};
