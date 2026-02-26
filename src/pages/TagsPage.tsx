/**
 * TagsPage.tsx
 * 태그 관리 페이지.
 * - 카테고리별 태그 목록 (Collapse/Tree) — Step 9에서 구현
 * - 태그 분할/병합 — Step 10에서 구현
 * - 복합 태그 관리 — Step 9~10에서 구현
 */
import { Card, Collapse, Tag, Typography, Alert, Space, Button } from 'antd';
import { TagsOutlined, MergeCellsOutlined, ScissorOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/** 샘플 태그 (Step 5에서 Zustand 스토어로 교체 예정) */
const sampleTags: Record<string, Array<{ name: string; description: string; tier: number }>> = {
  structure: [
    { name: 'IS_CONTROLLER', description: '@Controller 또는 @RestController 어노테이션이 있는 클래스', tier: 1 },
    { name: 'IS_SERVICE', description: '@Service 어노테이션이 있는 클래스', tier: 1 },
    { name: 'IS_REPOSITORY', description: '@Repository 어노테이션이 있는 클래스', tier: 1 },
  ],
  resource: [
    { name: 'USES_CONNECTION', description: 'JDBC Connection 객체 사용', tier: 1 },
    { name: 'USES_STATEMENT', description: 'JDBC Statement 객체 사용', tier: 1 },
  ],
  pattern: [
    { name: 'HAS_TRY_WITH_RESOURCES', description: 'try-with-resources 구문 사용', tier: 1 },
    { name: 'HAS_EMPTY_CATCH', description: '빈 catch 블록 존재', tier: 1 },
  ],
};

export default function TagsPage() {
  const collapseItems = Object.entries(sampleTags).map(([category, tags]) => ({
    key: category,
    label: (
      <Space>
        <TagsOutlined />
        <Text strong>{category}</Text>
        <Tag>{tags.length}개</Tag>
      </Space>
    ),
    children: (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <Card
            key={tag.name}
            size="small"
            style={{ width: 280 }}
            title={<Text code style={{ fontSize: 12 }}>{tag.name}</Text>}
            extra={<Tag color={tag.tier === 1 ? 'blue' : 'orange'}>Tier {tag.tier}</Tag>}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {tag.description}
            </Text>
          </Card>
        ))}
      </div>
    ),
  }));

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          태그 관리
        </Title>
        <Space>
          <Button icon={<ScissorOutlined />} disabled>
            태그 분할
          </Button>
          <Button icon={<MergeCellsOutlined />} disabled>
            태그 병합
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Step 9~10 구현 예정"
        description="카테고리별 태그 목록, 태그 분할/병합, 복합 태그 관리는 Step 9~10에서 구현됩니다. 현재는 샘플 데이터로 표시합니다."
        style={{ marginBottom: 24 }}
        closable
      />

      <Collapse
        items={collapseItems}
        defaultActiveKey={['structure', 'resource', 'pattern']}
        style={{ background: '#fff' }}
      />
    </div>
  );
}
