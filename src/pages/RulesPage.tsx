/**
 * src/pages/RulesPage.tsx
 *
 * 규칙 목록 페이지.
 * - Ant Design Table로 규칙 목록 표시
 * - category / severity / checkType / isActive 필터
 * - title · ruleId · description 텍스트 검색
 * - 행 클릭 → /rules/:ruleId 이동
 * - 규칙 추가 / 삭제 (로컬 스토어)
 *
 * 버그 수정:
 *   1. 필터 변경 시 유령 행 남는 문제
 *      → key={tableKey}로 Table 강제 리마운트 + 필터 변경 시 current 리셋
 *   2. pageSize 변경 안 되는 문제
 *      → pagination을 useState로 관리 + onChange 핸들러 추가
 *   3. 활성 여부 목록에서 직접 토글
 *      → isActive 컬럼 Badge → Switch로 교체
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
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
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

interface Filters {
  search:    string;
  category:  RuleCategory | 'all';
  severity:  RuleSeverity | 'all';
  checkType: RuleCheckType | 'all';
  isActive:  'all' | 'true' | 'false';
}

const INITIAL_FILTERS: Filters = {
  search:    '',
  category:  'all',
  severity:  'all',
  checkType: 'all',
  isActive:  'all',
};

export default function RulesPage() {
  const navigate      = useNavigate();
  const rules         = useDataStore((s) => s.rules);
  const deleteRule    = useDataStore((s) => s.deleteRule);
  const updateRule    = useDataStore((s) => s.updateRule);
  const isLoading     = useDataStore((s) => s.isLoading);
  const pull          = useDataStore((s) => s.pull);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [filters, setFilters]               = useState<Filters>(INITIAL_FILTERS);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Fix #2: pagination 상태로 관리
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current:  1,
    pageSize: 20,
  });

  const filteredRules = useMemo(() => {
    const keyword = filters.search.toLowerCase();
    return rules.filter((rule) => {
      if (filters.category  !== 'all' && rule.category  !== filters.category)  return false;
      if (filters.severity  !== 'all' && rule.severity  !== filters.severity)  return false;
      if (filters.checkType !== 'all' && rule.checkType !== filters.checkType) return false;
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

  // Fix #1: 필터 변경 시 current → 1 리셋
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const isFiltered =
    filters.search    !== ''    ||
    filters.category  !== 'all' ||
    filters.severity  !== 'all' ||
    filters.checkType !== 'all' ||
    filters.isActive  !== 'all';

  const handlePull = async () => {
    try {
      await pull();
      notifySuccess('Pull 완료', '서버에서 최신 데이터를 불러왔습니다.');
    } catch (err) {
      notifyError('Pull 실패', err instanceof Error ? err.message : undefined);
    }
  };

  const handleDelete = (ruleId: string) => {
    deleteRule(ruleId);
    notifySuccess('삭제 완료', `규칙 ${ruleId}이(가) 삭제되었습니다.`);
    setSelectedRowKeys((prev) => prev.filter((k) => k !== ruleId));
  };

  const handleDeleteSelected = () => {
    selectedRowKeys.forEach((id) => deleteRule(id));
    notifySuccess('삭제 완료', `${selectedRowKeys.length}개 규칙이 삭제되었습니다.`);
    setSelectedRowKeys([]);
  };

  // Fix #3: isActive 인라인 토글
  const handleToggleActive = (ruleId: string, checked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    updateRule(ruleId, { isActive: checked });
    notifySuccess(
      checked ? '활성화' : '비활성화',
      `규칙 ${ruleId}이(가) ${checked ? '활성화' : '비활성화'}되었습니다.`,
    );
  };

  const columns: ColumnsType<Rule> = [
    {
      title:     '규칙 ID',
      dataIndex: 'ruleId',
      key:       'ruleId',
      width:     160,
      sorter: (a, b) => a.ruleId.localeCompare(b.ruleId),
      render: (id: string) => (
        <Text code style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{id}</Text>
      ),
    },
    {
      title:    '제목',
      dataIndex: 'title',
      key:       'title',
      ellipsis:  true,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (title: string, record) => (
        <Tooltip title={record.description}><span>{title}</span></Tooltip>
      ),
    },
    {
      title:     '카테고리',
      dataIndex: 'category',
      key:       'category',
      width:     130,
      render: (c: RuleCategory) => (
        <Text style={{ fontSize: 12 }}>{RULE_CATEGORY_LABELS[c] ?? c}</Text>
      ),
    },
    {
      title:     '심각도',
      dataIndex: 'severity',
      key:       'severity',
      width:     90,
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
      title:     '검사 타입',
      dataIndex: 'checkType',
      key:       'checkType',
      width:     140,
      render: (t: RuleCheckType) => (
        <Text style={{ fontSize: 12 }}>{RULE_CHECK_TYPE_LABELS[t] ?? t}</Text>
      ),
    },
    {
      title:     '출처 파일',
      dataIndex: 'sourceFile',
      key:       'sourceFile',
      width:     130,
      render: (f: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{f}</Text>
      ),
    },
    {
      title:     '활성',
      dataIndex: 'isActive',
      key:       'isActive',
      width:     70,
      align:     'center',
      sorter: (a, b) => Number(b.isActive) - Number(a.isActive),
      render: (v: boolean, record) => (
        <Tooltip title={v ? '클릭하여 비활성화' : '클릭하여 활성화'}>
          <Switch
            size="small"
            checked={v}
            onClick={(checked, e) =>
              handleToggleActive(record.ruleId, checked, e as unknown as React.MouseEvent)
            }
          />
        </Tooltip>
      ),
    },
    {
      title: '',
      key:   'action',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <Popconfirm
          title="규칙 삭제"
          description={`"${record.title}"을(를) 삭제하시겠습니까?`}
          onConfirm={(e) => { e?.stopPropagation(); handleDelete(record.ruleId); }}
          onCancel={(e) => e?.stopPropagation()}
          okText="삭제" cancelText="취소"
          okButtonProps={{ danger: true }}
        >
          <Button
            type="text" danger size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => e.stopPropagation()}
          />
        </Popconfirm>
      ),
    },
  ];

  // Fix #1 핵심: 필터 조합이 바뀌면 Table을 완전히 리마운트
  // → Ant Design 내부 페이지 offset 상태 초기화 → 유령 행 제거
  const tableKey = `${filters.category}-${filters.severity}-${filters.checkType}-${filters.isActive}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space align="center">
          <Typography.Title level={4} style={{ margin: 0 }}>규칙 관리</Typography.Title>
          <Tag>{filteredRules.length} / {rules.length}개</Tag>
        </Space>
        <Space>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="선택 항목 삭제"
              description={`선택한 ${selectedRowKeys.length}개 규칙을 삭제하시겠습니까?`}
              onConfirm={handleDeleteSelected}
              okText="삭제" cancelText="취소"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                선택 삭제 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button icon={<ReloadOutlined />} onClick={handlePull} loading={isLoading}>
            Pull
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/rules/new')}>
            새 규칙
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} lg={6}>
            <Input
              placeholder="규칙 ID / 제목 / 설명 검색"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select style={{ width: '100%' }} value={filters.category} onChange={(v) => setFilter('category', v)}>
              <Option value="all">전체 카테고리</Option>
              {(Object.keys(RULE_CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                <Option key={c} value={c}>{RULE_CATEGORY_LABELS[c]}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Select style={{ width: '100%' }} value={filters.severity} onChange={(v) => setFilter('severity', v)}>
              <Option value="all">전체 심각도</Option>
              {(Object.keys(RULE_SEVERITY_LABELS) as RuleSeverity[]).map((s) => (
                <Option key={s} value={s}>
                  <Tag color={RULE_SEVERITY_COLORS[s]} style={{ margin: 0 }}>{RULE_SEVERITY_LABELS[s]}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} lg={4}>
            <Select style={{ width: '100%' }} value={filters.checkType} onChange={(v) => setFilter('checkType', v)}>
              <Option value="all">전체 타입</Option>
              {(Object.keys(RULE_CHECK_TYPE_LABELS) as RuleCheckType[]).map((t) => (
                <Option key={t} value={t}>{RULE_CHECK_TYPE_LABELS[t]}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={6} lg={3}>
            <Select style={{ width: '100%' }} value={filters.isActive} onChange={(v) => setFilter('isActive', v)}>
              <Option value="all">전체</Option>
              <Option value="true"><Badge status="success" text="활성" /></Option>
              <Option value="false"><Badge status="default" text="비활성" /></Option>
            </Select>
          </Col>
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

      <Table<Rule>
        key={tableKey}
        columns={columns}
        dataSource={filteredRules}
        rowKey="ruleId"
        loading={isLoading}
        size="small"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} / 전체 ${total}개`,
          onChange: (page, size) => setPagination({ current: page, pageSize: size }),
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
          emptyText: rules.length === 0
            ? 'Pull을 실행하여 서버에서 규칙을 불러오세요.'
            : '조건에 맞는 규칙이 없습니다.',
        }}
        scroll={{ x: 900 }}
      />

      <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Switch size="small" checked disabled style={{ marginRight: 4 }} />
          활성: IntelliJ 플러그인 검사에 포함됨
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <Switch size="small" checked={false} disabled style={{ marginRight: 4 }} />
          비활성: 검사에서 제외됨
        </Text>
        <Text type="secondary" style={{ fontSize: 12, color: '#1677ff' }}>
          ※ 활성 토글을 목록에서 직접 클릭하여 변경할 수 있습니다.
        </Text>
      </div>
    </div>
  );
}