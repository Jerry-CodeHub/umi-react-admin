import { ProCard } from '@ant-design/pro-components';
import { rectSortingStrategy } from '@dnd-kit/sortable';

import { GridContainer } from './components/GridContainer';
import { Sortable, Props as SortableProps } from './components/Sortable';

const props: Partial<SortableProps> = {
  adjustScale: true,
  Container: ({ children }) => <GridContainer columns={5}>{children}</GridContainer>,
  strategy: rectSortingStrategy,
  wrapperStyle: () => ({
    width: 140,
    height: 140,
  }),
};

export default function DndKit() {
  return (
    <ProCard className="shadow-2xl">
      <Sortable {...props} useDragOverlay={false} />
    </ProCard>
  );
}
