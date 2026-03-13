import { Cascader as FormilyCascader } from '@formily/antd-v5';
import { createBehavior, createResource } from '@pind/designable-core';
import { DnFC } from '@pind/designable-react';
import React from 'react';
import { AllLocales } from '../../locales';
import { AllSchemas } from '../../schemas';
import { createFieldSchema } from '../Field';

export const Cascader: DnFC<React.ComponentProps<typeof FormilyCascader>> = FormilyCascader;

Cascader.Behavior = createBehavior({
  name: 'Cascader',
  extends: ['Field'],
  selector: (node) => node.props['x-component'] === 'Cascader',
  designerProps: {
    propsSchema: createFieldSchema(AllSchemas.Cascader),
  },
  designerLocales: AllLocales.Cascader,
});

Cascader.Resource = createResource('Inputs', {
  icon: 'CascaderSource',
  elements: [
    {
      componentName: 'Field',
      props: {
        title: 'Cascader',
        'x-decorator': 'FormItem',
        'x-component': 'Cascader',
      },
    },
  ],
});
