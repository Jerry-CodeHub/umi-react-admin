import { observer, ReactFC } from '@formily/reactive-react';
import { DroppableWidget } from '@pind/designable-react';
import React from 'react';
import './styles.less';

export const Container: ReactFC = observer((props) => {
  return <DroppableWidget>{props.children}</DroppableWidget>;
});

export const withContainer = <P extends object>(Target: React.JSXElementConstructor<P>) => {
  return (props: P) => {
    return (
      <DroppableWidget>
        <Target {...props} />
      </DroppableWidget>
    );
  };
};
