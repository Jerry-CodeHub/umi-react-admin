import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Row } from 'antd';
import DemoColumn from './components/DemoColumn';
import DemoSankey from './components/DemoSankey';
import DemoScatter from './components/DemoScatter';
import DemoSunburst from './components/DemoSunburst';
import DemoLine from './components/Line';

const HomePage: React.FC = () => {
  return (
    <PageContainer ghost header={{ title: '' }}>
      <Row>
        <Col span={8} className="pr-2">
          <Card title="折线 · 股价走势">
            <DemoLine />
          </Card>
        </Col>
        <Col span={8} className="pr-2">
          <Card title="柱状图">
            <DemoColumn />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="旭日图">
            <DemoSunburst />
          </Card>
        </Col>
      </Row>
      <Row className="mt-2">
        <Col span={16} className="pr-2">
          <Card title="桑基图">
            <DemoSankey />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="散点 · 时序分布">
            <DemoScatter />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default HomePage;
