/**
 * RulesPage.tsx
 * 규칙 목록 페이지.
 * - 규칙 테이블 (category/severity/checkType/isActive 필터, 검색) — Step 7에서 구현
 * - 규칙 추가/삭제 — Step 7에서 구현
 */
import { Button, Space, Table, Typography, Alert, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { type Rule, RULE_SEVERITY_COLORS, RULE_CATEGORY_LABELS, RULE_CHECK_TYPE_LABELS } from '@/types/rule';

const { Title } = Typography;

/** 샘플 데이터 (Step 5에서 Zustand 스토어로 교체 예정) */
const sampleRules: Pick<Rule, 'ruleId' | 'title' | 'category' | 'severity' | 'checkType' | 'isActive'>[] = [
  { ruleId: 'G1.RES.3_2_1', title: 'Connection 리소스 미해제',              category: 'resource_management', severity: 'CRITICAL', checkType: 'llm_with_regex', isActive: true },
  { ruleId: 'G1.SEC.5_1_1', title: 'SQL Injection 취약점 방지',              category: 'security',            severity: 'CRITICAL', checkType: 'llm_with_regex', isActive: true },
  { ruleId: 'G1.ERR.7_3_1', title: '비즈니스 로직에서 LBizException 사용',   category: 'exception_handling',  severity: 'MEDIUM',   checkType: 'llm_with_regex', isActive: true },
];

export default function RulesPage() {
  const navigate = useNavigate();

  const columns = [
    {
      title: '규칙 ID',
      dataIndex: 'ruleId',
      key: 'ruleId',
      render: (id: string) => (
        <a onClick={() => navigate(`/rules/${id}`)} style={{ fontFamily: 'monospace' }}>
          {id}
        </a>
      ),
    },
    { title: '제목', dataIndex: 'title', key: 'title' },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      render: (c: string) => RULE_CATEGORY_LABELS[c as keyof typeof RULE_CATEGORY_LABELS] ?? c,
    },
    {
      title: '심각도',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string) => (
        <Tag color={RULE_SEVERITY_COLORS[s as keyof typeof RULE_SEVERITY_COLORS] ?? 'default'}>
          {s}
        </Tag>
      ),
    },
    {
      title: '검사 타입',
      dataIndex: 'checkType',
      key: 'checkType',
      render: (t: string) => RULE_CHECK_TYPE_LABELS[t as keyof typeof RULE_CHECK_TYPE_LABELS] ?? t,
    },
    {
      title: '활성',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? '활성' : '비활성'}</Tag>,
    },
  ];

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
          규칙 관리
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rules/new')}>
            새 규칙
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        message="Step 7 구현 예정"
        description="필터링, 검색, Zustand 스토어 연동은 Step 7에서 구현됩니다. 현재는 샘플 데이터로 표시합니다."
        style={{ marginBottom: 16 }}
        closable
      />

      <Table
        columns={columns}
        dataSource={sampleRules}
        rowKey="ruleId"
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}