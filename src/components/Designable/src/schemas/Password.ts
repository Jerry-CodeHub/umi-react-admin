import { ISchema } from '@formily/react';
import { Input } from './Input';
export const Password: ISchema = {
  type: 'object',
  properties: {
    ...((Input.properties || {}) as unknown as Record<string, ISchema>),
    checkStrength: {
      type: 'boolean',
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
    },
  },
};
