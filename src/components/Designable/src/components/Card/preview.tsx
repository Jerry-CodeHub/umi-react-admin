import { Card as AntdCard } from 'antd';
import React from 'react';

import { createBehavior, createResource } from '@pind/designable-core';
import { DnFC } from '@pind/designable-react';
import { AllLocales } from '../../locales';
import { AllSchemas } from '../../schemas';
import { createVoidFieldSchema } from '../Field';

export const Card: DnFC<React.ComponentProps<typeof AntdCard>> = (props) => {
  return (
    <AntdCard {...props} title={<span data-content-editable="x-component-props.title">{props.title}</span>}>
      {props.children}
    </AntdCard>
  );
};

Card.Behavior = createBehavior({
  name: 'Card',
  extends: ['Field'],
  selector: (node) => node.props['x-component'] === 'Card',
  designerProps: {
    droppable: true,
    propsSchema: createVoidFieldSchema(AllSchemas.Card),
  },
  designerLocales: AllLocales.Card,
});

Card.Resource = createResource('Layouts', {
  icon: 'CardSource',
  elements: [
    {
      componentName: 'Field',
      props: {
        type: 'void',
        'x-component': 'Card',
        'x-component-props': {
          title: 'Title',
        },
      },
    },
  ],
});
