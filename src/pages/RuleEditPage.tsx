/**
 * RuleEditPage.tsx
 * 규칙 편집 페이지.
 * - 폼 모드 (Ant Design Form) — Step 8에서 구현
 * - JSON 직접 편집 모드 (Monaco Editor) — Step 8에서 구현
 * - 유효성 검사 — Step 8에서 구현
 */
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Space, Typography, Alert, Descriptions } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export default function RuleEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  return (
    <div>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rules')}>
          목록으로
        </Button>
        <Title level={4} style={{ margin: 0 }}>
          {isNew ? '새 규칙 추가' : `규칙 편집: ${id}`}
        </Title>
      </div>

      <Alert
        type="info"
        showIcon
        message="Step 8 구현 예정"
        description="규칙 폼, JSON 에디터(Monaco), 유효성 검사는 Step 8에서 구현됩니다."
        style={{ marginBottom: 24 }}
        closable
      />

      <Card
        title={
          <Space>
            <EditOutlined />
            {isNew ? '새 규칙' : id}
          </Space>
        }
      >
        {isNew ? (
          <Text type="secondary">새 규칙을 추가합니다. (Step 8 구현 예정)</Text>
        ) : (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="규칙 ID">
              <Text code>{id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="상태">
              Step 8에서 실제 데이터와 연동 예정
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </div>
  );
}
