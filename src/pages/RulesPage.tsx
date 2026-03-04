/**
 * src/pages/RulesPage.tsx
 *
 * 규칙 목록 페이지.
 * - Ant Design Table로 규칙 목록 표시
 * - category / severity / checkType / isActive 필터
 * - title · ruleId · description 텍스트 검색
 * - 행 클릭 → /rules/:ruleId 이동
 * - 규칙 추가 / 삭제 (로컬 스토어)
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Switch,
  Tag,
  Typography,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Card,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { Rule, RuleCategory, RuleSeverity, RuleCheckType } from '@/types/rule';
import {
  RULE_CATEGORY_LABELS,
  RULE_SEVERITY_LABELS,
  RULE_SEVERITY_COLORS,
  RULE_CHECK_TYPE_LABELS,
} from '@/types/rule';

const { Text } = Typography;
const { Option } = Select;

// ─────────────────────────────────────────────────────────────────────────────
// 필터 상태 타입
// ─────────────────────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  category: RuleCategory | 'all';
  severity: RuleSeverity | 'all';
  checkType: RuleCheckType | 'all';
  isActive: 'all' | 'true' | 'false';
}

const INITIAL_FILTERS: Filters = {
  search:    '',
  category:  'all',
  severity:  'all',
  checkType: 'all',
  isActive:  'all',
};

// ─────────────────────────────────────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const navigate     = useNavigate();
  const rules        = useDataStore((s) => s.rules);
  const deleteRule   = useDataStore((s) => s.deleteRule);
  const isLoading    = useDataStore((s) => s.isLoading);
  const pull         = useDataStore((s) => s.pull);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [filters, setFilters]               = useState<Filters>(INITIAL_FILTERS);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // ── 필터 적용 ─────────────────────────────────────────────────────────────
  const filteredRules = useMemo(() => {
    const keyword = filters.search.toLowerCase();

    return rules.filter((rule) => {
      if (filters.category !== 'all' && rule.category !== filters.category)
        return false;
      if (filters.severity !== 'all' && rule.severity !== filters.severity)
        return false;
      if (filters.checkType !== 'all' && rule.checkType !== filters.checkType)
        return false;
      if (filters.isActive === 'true'  && !rule.isActive) return false;
      if (filters.isActive === 'false' &&  rule.isActive) return false;
      if (keyword) {
        const hit =
          rule.ruleId.toLowerCase().includes(keyword)      ||
          rule.title.toLowerCase().includes(keyword)       ||
          rule.description.toLowerCase().includes(keyword);
        if (!hit) return false;
      }
      return true;
    });
  }, [rules, filters]);

  // ── 필터 변경 헬퍼 ────────────────────────────────────────────────────────
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => setFilters(INITIAL_FILTERS);

  const isFiltered =
    filters.search !== ''       ||
    filters.category  !== 'all' ||
    filters.severity  !== 'all' ||
    filters.checkType !== 'all' ||
    filters.isActive  !== 'all';

  // ── Pull ──────────────────────────────────────────────────────────────────
  const handlePull = async () => {
    try {
      await pull();
      notifySuccess('Pull 완료', '서버에서 최신 데이터를 불러왔습니다.');
    } catch (err) {
      notifyError('Pull 실패', err instanceof Error ? err.message : undefined);
    }
  };

  // ── 단건 삭제 ─────────────────────────────────────────────────────────────
  const handleDelete = (ruleId: string) => {
    deleteRule(ruleId);
    notifySuccess('삭제 완료', `규칙 ${ruleId}이(가) 삭제되었습니다.`);
    setSelectedRowKeys((prev) => prev.filter((k) => k !== ruleId));
  };

  // ── 선택 삭제 ─────────────────────────────────────────────────────────────
  const handleDeleteSelected = () => {
    selectedRowKeys.forEach((id) => deleteRule(id));
    notifySuccess('삭제 완료', `${selectedRowKeys.length}개 규칙이 삭제되었습니다.`);
    setSelectedRowKeys([]);
  };

  // ── 컬럼 정의 ─────────────────────────────────────────────────────────────
  const columns: ColumnsType<Rule> = [
    {
      title: '규칙 ID',
      dataIndex: 'ruleId',
      key: 'ruleId',
      width: 160,
      sorter: (a, b) => a.ruleId.localeCompare(b.ruleId),
      render: (id: string) => (
        <Text code style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {id}
        </Text>
      ),
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (title: string, record) => (
        <Tooltip title={record.description}>
          <span>{title}</span>
        </Tooltip>
      ),
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      render: (c: RuleCategory) => (
        <Text style={{ fontSize: 12 }}>
          {RULE_CATEGORY_LABELS[c] ?? c}
        </Text>
      ),
    },
    {
      title: '심각도',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      sorter: (a, b) => {
        const order: RuleSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        return order.indexOf(a.severity) - order.indexOf(b.severity);
      },
      render: (s: RuleSeverity) => (
        <Tag color={RULE_SEVERITY_COLORS[s]} style={{ fontSize: 11 }}>
          {RULE_SEVERITY_LABELS[s]}
        </Tag>
      ),
    },
    {
      title: '검사 타입',
      dataIndex: 'checkType',
      key: 'checkType',
      width: 140,
      render: (t: RuleCheckType) => (
        <Text style={{ fontSize: 12 }}>
          {RULE_CHECK_TYPE_LABELS[t] ?? t}
        </Text>
      ),
    },
    {
      title: '출처 파일',
      dataIndex: 'sourceFile',
      key: 'sourceFile',
      width: 130,
      render: (f: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {f}
        </Text>
      ),
    },
    {
      title: '활성',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 70,
      align: 'center',
      sorter: (a, b) => Number(b.isActive) - Number(a.isActive),
      render: (v: boolean) => (
        <Badge
          status={v ? 'success' : 'default'}
          text={
            <Text style={{ fontSize: 12 }}>{v ? '활성' : '비활성'}</Text>
          }
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title="규칙 삭제"
          description={`"${record.title}"을(를) 삭제하시겠습니까?`}
          onConfirm={(e) => {
            e?.stopPropagation();
            handleDelete(record.ruleId);
          }}
          onCancel={(e) => e?.stopPropagation()}
          okText="삭제"
          cancelText="취소"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {/* ── 타이틀 + 액션 버튼 ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>
            규칙 관리
          </Typography.Title>
          <Tag>{filteredRules.length} / {rules.length}개</Tag>
        </Space>

        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="선택 항목 삭제"
              description={`선택한 ${selectedRowKeys.length}개 규칙을 삭제하시겠습니까?`}
              onConfirm={handleDeleteSelected}
              okText="삭제"
              cancelText="취소"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                선택 삭제 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handlePull}
            loading={isLoading}
          >
            Pull
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/rules/new')}
          >
            새 규칙
          </Button>
        </Space>
      </div>

      {/* ── 필터 영역 ─────────────────────────────────────────────────────── */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Row gutter={[12, 12]} align="middle">
          {/* 텍스트 검색 */}
          <Col xs={24} sm={12} lg={6}>
            <Input
              placeholder="규칙 ID / 제목 / 설명 검색"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              allowClear
            />
          </Col>

          {/* 카테고리 */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              value={filters.category}
              onChange={(v) => setFilter('category', v)}
              placeholder="카테고리"
            >
              <Option value="all">전체 카테고리</Option>
              {(Object.keys(RULE_CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                <Option key={c} value={c}>
                  {RULE_CATEGORY_LABELS[c]}
                </Option>
              ))}
            </Select>
          </Col>

          {/* 심각도 */}
          <Col xs={12} sm={6} lg={3}>
            <Select
              style={{ width: '100%' }}
              value={filters.severity}
              onChange={(v) => setFilter('severity', v)}
              placeholder="심각도"
            >
              <Option value="all">전체 심각도</Option>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RuleSeverity[]).map((s) => (
                <Option key={s} value={s}>
                  <Tag color={RULE_SEVERITY_COLORS[s]} style={{ fontSize: 11 }}>
                    {RULE_SEVERITY_LABELS[s]}
                  </Tag>
                </Option>
              ))}
            </Select>
          </Col>

          {/* 검사 타입 */}
          <Col xs={12} sm={6} lg={4}>
            <Select
              style={{ width: '100%' }}
              value={filters.checkType}
              onChange={(v) => setFilter('checkType', v)}
              placeholder="검사 타입"
            >
              <Option value="all">전체 타입</Option>
              {(Object.keys(RULE_CHECK_TYPE_LABELS) as RuleCheckType[]).map((t) => (
                <Option key={t} value={t}>
                  {RULE_CHECK_TYPE_LABELS[t]}
                </Option>
              ))}
            </Select>
          </Col>

          {/* 활성 여부 */}
          <Col xs={12} sm={6} lg={3}>
            <Select
              style={{ width: '100%' }}
              value={filters.isActive}
              onChange={(v) => setFilter('isActive', v)}
              placeholder="활성 여부"
            >
              <Option value="all">전체</Option>
              <Option value="true">
                <Badge status="success" text="활성" />
              </Option>
              <Option value="false">
                <Badge status="default" text="비활성" />
              </Option>
            </Select>
          </Col>

          {/* 필터 초기화 */}
          <Col xs={24} sm={6} lg={2}>
            <Button
              icon={<FilterOutlined />}
              onClick={resetFilters}
              disabled={!isFiltered}
              style={{ width: '100%' }}
            >
              초기화
            </Button>
          </Col>
        </Row>
      </Card>

      {/* ── 규칙 테이블 ───────────────────────────────────────────────────── */}
      <Table<Rule>
        columns={columns}
        dataSource={filteredRules}
        rowKey="ruleId"
        loading={isLoading}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} / 전체 ${total}개`,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/rules/${record.ruleId}`),
          style: { cursor: 'pointer' },
        })}
        locale={{
          emptyText:
            rules.length === 0
              ? 'Pull을 실행하여 서버에서 규칙을 불러오세요.'
              : '조건에 맞는 규칙이 없습니다.',
        }}
        scroll={{ x: 900 }}
      />

      {/* 활성 여부 범례 */}
      <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Switch size="small" checked disabled style={{ marginRight: 4 }} />
          활성 규칙: IntelliJ 플러그인 검사에 포함됨
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Switch size="small" checked={false} disabled style={{ marginRight: 4 }} />
          비활성 규칙: 검사에서 제외됨
        </Text>
      </div>
    </div>
  );
}