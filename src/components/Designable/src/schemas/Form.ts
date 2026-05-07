import { ISchema } from '@formily/react';
import { CSSStyle } from './CSSStyle';
import { FormLayout } from './FormLayout';

export const Form: ISchema = {
  type: 'object',
  properties: {
    ...((FormLayout.properties || {}) as unknown as Record<string, ISchema>),
    style: CSSStyle,
  },
};
