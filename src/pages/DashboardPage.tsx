/**
 * DashboardPage.tsx
 * 대시보드 페이지.
 * - 서버 연결 상태 (🟢/🔴) — Step 6에서 /health 폴링 연동 예정
 * - 규칙/태그 통계 — Step 6에서 /api/data/stats 연동 예정
 * - 마지막 Pull/Push 시각 — Step 5에서 IndexedDB 연동 예정
 */
import { Card, Col, Row, Statistic, Typography, Space, Tag, Alert } from 'antd';
import {
  FileTextOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function DashboardPage() {
  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>
        대시보드
      </Title>

      <Alert
        type="info"
        showIcon
        message="Step 5~6 구현 예정"
        description="현재는 레이아웃 확인용 플레이스홀더입니다. Step 5에서 Zustand 스토어 + Pull 연동, Step 6에서 서버 상태 폴링 및 Stats 위젯이 추가됩니다."
        style={{ marginBottom: 24 }}
        closable
      />

      {/* 서버 연결 상태 */}
      <Card
        title={
          <Space>
            <ApiOutlined />
            서버 연결 상태
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Space>
          <Tag color="default">⏳ 연결 확인 중...</Tag>
          <Text type="secondary">서버: {import.meta.env.VITE_API_URL || 'http://localhost:3000'}</Text>
        </Space>
      </Card>

      {/* 통계 카드 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="전체 규칙"
              value="—"
              prefix={<FileTextOutlined />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="활성 규칙"
              value="—"
              valueStyle={{ color: '#52c41a' }}
              prefix={<FileTextOutlined />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="전체 태그"
              value="—"
              prefix={<TagsOutlined />}
              suffix="개"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="복합 태그"
              value="—"
              prefix={<TagsOutlined />}
              suffix="개"
            />
          </Card>
        </Col>
      </Row>

      {/* Pull/Push 시각 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                마지막 Pull
              </Space>
            }
          >
            <Text type="secondary">데이터 없음 (Pull을 실행해주세요)</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                마지막 Push
              </Space>
            }
          >
            <Text type="secondary">데이터 없음</Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
