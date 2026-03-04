/**
 * src/pages/TagsPage.tsx
 *
 * 태그 관리 페이지.
 * - 태그 목록: 카테고리별 Collapse 그룹핑
 * - 각 태그: name, tier, extractionMethod, detection.type, description
 * - 복합 태그(compoundTags) 섹션: requires / excludes 표시
 * - 태그 추가/수정/삭제 (로컬 스토어)
 * - tagCategories 표시 및 편집
 * - 태그 분할 / 병합 (TagSplit, TagMerge)
 */
import { useState, useMemo } from 'react';
import {
  Collapse,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Badge,
  Card,
  Row,
  Col,
  Tooltip,
  Empty,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  TagsOutlined,
  AppstoreOutlined,
  ScissorOutlined,
  MergeCellsOutlined,
} from '@ant-design/icons';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type {
  TagDefinition,
  CompoundTag,
  TagExtractionMethod,
} from '@/types/tag';
import {
  TAG_EXTRACTION_METHOD_LABELS,
  TAG_TIER_LABELS,
} from '@/types/tag';
import TagSplit from '@/components/tags/TagSplit';
import TagMerge from '@/components/tags/TagMerge';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<number, string> = { 1: 'blue', 2: 'purple' };
const EXTRACTION_COLORS: Record<TagExtractionMethod, string> = {
  regex: 'green',
  ast:   'orange',
  llm:   'red',
};
const DETECTION_TYPE_COLORS: Record<string, string> = {
  regex:       'green',
  ast:         'orange',
  ast_context: 'gold',
  llm:         'red',
};

// ─────────────────────────────────────────────────────────────────────────────
// 태그 편집 모달
// ─────────────────────────────────────────────────────────────────────────────

interface TagModalProps {
  open: boolean;
  tagName: string | null;
  initial?: TagDefinition;
  categories: string[];
  onOk: (name: string, tag: TagDefinition) => void;
  onCancel: () => void;
}

function TagModal({ open, tagName, initial, categories, onOk, onCancel }: TagModalProps) {
  const [form] = Form.useForm();
  const isNew  = tagName === null;

  const buildDetection = (values: Record<string, unknown>) => {
    const type = values.detectionType as string;
    if (type === 'regex') {
      const raw = (values.patterns as string) ?? '';
      return {
        type: 'regex' as const,
        patterns: raw.split('\n').map((p: string) => p.trim()).filter(Boolean),
        matchType: (values.matchType as 'any' | 'all' | 'none') ?? 'any',
      };
    }
    if (type === 'llm') {
      return {
        type: 'llm' as const,
        criteria: (values.criteria as string) ?? '',
        triggerTags: ((values.triggerTags as string) ?? '')
          .split(',').map((t: string) => t.trim()).filter(Boolean),
      };
    }
    return { type: type as 'ast', nodeType: values.nodeType as string | undefined };
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const detection = buildDetection(values);
      const tag: TagDefinition = {
        category:         values.category,
        description:      values.description,
        extractionMethod: values.extractionMethod,
        tier:             values.tier,
        detection,
      };
      onOk(isNew ? values.name : tagName!, tag);
      form.resetFields();
    } catch { /* validateFields 에러는 폼에서 표시 */ }
  };

  const getInitialValues = () => {
    if (!initial) {
      return {
        tier: 1,
        extractionMethod: 'regex',
        detectionType: 'regex',
        matchType: 'any',
      };
    }
    const d = initial.detection;
    return {
      category:         initial.category,
      description:      initial.description,
      extractionMethod: initial.extractionMethod,
      tier:             initial.tier,
      detectionType:    d.type,
      patterns:    d.type === 'regex' ? (d.patterns ?? []).join('\n') : '',
      matchType:   d.type === 'regex' ? (d.matchType ?? 'any') : 'any',
      criteria:    d.type === 'llm'   ? (d.criteria ?? '') : '',
      triggerTags: d.type === 'llm'   ? (d.triggerTags ?? []).join(', ') : '',
    };
  };

  return (
    <Modal
      title={isNew ? '태그 추가' : `태그 수정: ${tagName}`}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText="저장"
      cancelText="취소"
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={getInitialValues()}>
        {isNew && (
          <Form.Item
            name="name"
            label="태그 이름"
            rules={[{ required: true, message: '태그 이름은 필수입니다.' }]}
          >
            <Input
              placeholder="예: IS_SERVICE"
              style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
            />
          </Form.Item>
        )}

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category" label="카테고리" rules={[{ required: true }]}>
              <Select>
                {categories.map((c) => <Option key={c} value={c}>{c}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="tier" label="티어">
              <Select>
                <Option value={1}>Tier 1 (빠른 추출)</Option>
                <Option value={2}>Tier 2 (LLM)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="extractionMethod" label="추출 방식">
              <Select>
                {(Object.keys(TAG_EXTRACTION_METHOD_LABELS) as TagExtractionMethod[]).map((m) => (
                  <Option key={m} value={m}>{TAG_EXTRACTION_METHOD_LABELS[m]}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="설명" rules={[{ required: true }]}>
          <Input placeholder="태그 설명" />
        </Form.Item>

        <Form.Item name="detectionType" label="탐지 타입">
          <Select>
            <Option value="regex">regex</Option>
            <Option value="ast">ast</Option>
            <Option value="ast_context">ast_context</Option>
            <Option value="llm">llm</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.detectionType !== cur.detectionType}
        >
          {({ getFieldValue }) => {
            const type = getFieldValue('detectionType');
            if (type === 'regex') return (
              <>
                <Form.Item name="patterns" label="패턴 (줄바꿈으로 구분)">
                  <TextArea
                    rows={3}
                    placeholder="정규식 패턴 (한 줄에 하나)"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Form.Item>
                <Form.Item name="matchType" label="매치 조건">
                  <Select>
                    <Option value="any">any (하나라도 매칭)</Option>
                    <Option value="all">all (모두 매칭)</Option>
                    <Option value="none">none (하나도 매칭 안됨)</Option>
                  </Select>
                </Form.Item>
              </>
            );
            if (type === 'llm') return (
              <>
                <Form.Item name="criteria" label="판단 기준 (LLM 프롬프트)">
                  <TextArea rows={3} placeholder="LLM에게 전달할 판단 기준" />
                </Form.Item>
                <Form.Item name="triggerTags" label="선행 조건 태그 (쉼표 구분)">
                  <Input
                    placeholder="예: IS_CONTROLLER, IS_SERVICE"
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </>
            );
            return null;
          }}
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 복합 태그 편집 모달
// ─────────────────────────────────────────────────────────────────────────────

interface CompoundTagModalProps {
  open: boolean;
  tagName: string | null;
  initial?: CompoundTag;
  onOk: (name: string, tag: CompoundTag) => void;
  onCancel: () => void;
}

function CompoundTagModal({ open, tagName, initial, onOk, onCancel }: CompoundTagModalProps) {
  const [form] = Form.useForm();
  const isNew  = tagName === null;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const tag: CompoundTag = {
        description: values.description,
        requires: (values.requires as string ?? '')
          .split(',').map((t: string) => t.trim()).filter(Boolean),
        excludes: (values.excludes as string ?? '')
          .split(',').map((t: string) => t.trim()).filter(Boolean),
        severity:   values.severity   || undefined,
        expression: values.expression || undefined,
      };
      onOk(isNew ? values.name : tagName!, tag);
      form.resetFields();
    } catch { /* validateFields 에러 */ }
  };

  const getInitialValues = () => ({
    description: initial?.description ?? '',
    requires:    (initial?.requires ?? []).join(', '),
    excludes:    (initial?.excludes ?? []).join(', '),
    severity:    initial?.severity ?? '',
    expression:  initial?.expression ?? '',
  });

  return (
    <Modal
      title={isNew ? '복합 태그 추가' : `복합 태그 수정: ${tagName}`}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText="저장"
      cancelText="취소"
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={getInitialValues()}>
        {isNew && (
          <Form.Item name="name" label="복합 태그 이름" rules={[{ required: true }]}>
            <Input
              placeholder="예: resource_leak_risk"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>
        )}
        <Form.Item name="description" label="설명" rules={[{ required: true }]}>
          <Input placeholder="복합 태그 설명" />
        </Form.Item>
        <Form.Item name="requires" label="필수 태그 (쉼표 구분)">
          <Input
            placeholder="예: USES_CONNECTION, HAS_SQL_CONCATENATION"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Form.Item name="excludes" label="제외 태그 (쉼표 구분)">
          <Input
            placeholder="예: HAS_TRY_WITH_RESOURCES"
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="severity" label="심각도 (선택)">
              <Select allowClear placeholder="선택 안함">
                {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                  <Option key={s} value={s}>{s}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="expression" label="불리언 표현식 (선택)">
              <Input
                placeholder="예: TAG_A && !TAG_B"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 카테고리 편집 모달
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryModalProps {
  open: boolean;
  catId: string | null;
  initial?: string;
  onOk: (id: string, description: string) => void;
  onCancel: () => void;
}

function CategoryModal({ open, catId, initial, onOk, onCancel }: CategoryModalProps) {
  const [form] = Form.useForm();
  const isNew  = catId === null;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(isNew ? values.id : catId!, values.description);
      form.resetFields();
    } catch { /* validateFields 에러 */ }
  };

  return (
    <Modal
      title={isNew ? '카테고리 추가' : `카테고리 수정: ${catId}`}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText="저장"
      cancelText="취소"
      width={400}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ id: catId ?? '', description: initial ?? '' }}
      >
        {isNew && (
          <Form.Item name="id" label="카테고리 ID" rules={[{ required: true }]}>
            <Input placeholder="예: framework" />
          </Form.Item>
        )}
        <Form.Item name="description" label="설명" rules={[{ required: true }]}>
          <Input placeholder="예: 프레임워크 관련" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const tags              = useDataStore((s) => s.tags);
  const isLoading         = useDataStore((s) => s.isLoading);
  const pull              = useDataStore((s) => s.pull);
  const upsertTag         = useDataStore((s) => s.upsertTag);
  const deleteTag         = useDataStore((s) => s.deleteTag);
  const upsertCompoundTag = useDataStore((s) => s.upsertCompoundTag);
  const deleteCompoundTag = useDataStore((s) => s.deleteCompoundTag);
  const upsertTagCategory = useDataStore((s) => s.upsertTagCategory);
  const deleteTagCategory = useDataStore((s) => s.deleteTagCategory);
  const notifySuccess     = useUiStore((s) => s.notifySuccess);
  const notifyError       = useUiStore((s) => s.notifyError);

  // ── 모달 상태 ─────────────────────────────────────────────────────────────
  const [tagModal, setTagModal]           = useState<{ open: boolean; name: string | null }>({ open: false, name: null });
  const [compoundModal, setCompoundModal] = useState<{ open: boolean; name: string | null }>({ open: false, name: null });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [splitOpen, setSplitOpen]         = useState(false);
  const [mergeOpen, setMergeOpen]         = useState(false);

  // ── 카테고리별 태그 그룹핑 ────────────────────────────────────────────────
  const tagsByCategory = useMemo(() => {
    const map: Record<string, Array<{ name: string; def: TagDefinition }>> = {};
    Object.entries(tags.tags).forEach(([name, def]) => {
      const cat = def.category || 'uncategorized';
      if (!map[cat]) map[cat] = [];
      map[cat].push({ name, def });
    });
    return map;
  }, [tags.tags]);

  const categoryList  = Object.keys(tags.tagCategories);
  const tagCount      = Object.keys(tags.tags).length;
  const compoundCount = Object.keys(tags.compoundTags).length;

  // ── Pull ──────────────────────────────────────────────────────────────────
  const handlePull = async () => {
    try {
      await pull();
      notifySuccess('Pull 완료', '서버에서 최신 데이터를 불러왔습니다.');
    } catch (err) {
      notifyError('Pull 실패', err instanceof Error ? err.message : undefined);
    }
  };

  // ── 태그 저장 ─────────────────────────────────────────────────────────────
  const handleTagOk = (name: string, tag: TagDefinition) => {
    upsertTag(name, tag);
    notifySuccess('저장 완료', `태그 ${name}이(가) 저장되었습니다.`);
    setTagModal({ open: false, name: null });
  };

  // ── 복합 태그 저장 ────────────────────────────────────────────────────────
  const handleCompoundOk = (name: string, tag: CompoundTag) => {
    upsertCompoundTag(name, tag);
    notifySuccess('저장 완료', `복합 태그 ${name}이(가) 저장되었습니다.`);
    setCompoundModal({ open: false, name: null });
  };

  // ── 카테고리 저장 ─────────────────────────────────────────────────────────
  const handleCategoryOk = (id: string, description: string) => {
    upsertTagCategory(id, description);
    notifySuccess('저장 완료', `카테고리 ${id}이(가) 저장되었습니다.`);
    setCategoryModal({ open: false, id: null });
  };

  // ── 태그 테이블 컬럼 ──────────────────────────────────────────────────────
  const tagColumns: ColumnsType<{ name: string; def: TagDefinition }> = [
    {
      title: '태그 이름',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string) => (
        <Text code style={{ fontSize: 12 }}>{name}</Text>
      ),
    },
    {
      title: 'Tier',
      key: 'tier',
      width: 130,
      render: (_, { def }) => (
        <Tag color={TIER_COLORS[def.tier] ?? 'default'} style={{ fontSize: 11 }}>
          {TAG_TIER_LABELS[def.tier]}
        </Tag>
      ),
    },
    {
      title: '추출 방식',
      key: 'extractionMethod',
      width: 90,
      render: (_, { def }) => (
        <Tag color={EXTRACTION_COLORS[def.extractionMethod]} style={{ fontSize: 11 }}>
          {TAG_EXTRACTION_METHOD_LABELS[def.extractionMethod]}
        </Tag>
      ),
    },
    {
      title: '탐지 타입',
      key: 'detectionType',
      width: 100,
      render: (_, { def }) => (
        <Tag
          color={DETECTION_TYPE_COLORS[def.detection.type] ?? 'default'}
          style={{ fontSize: 11 }}
        >
          {def.detection.type}
        </Tag>
      ),
    },
    {
      title: '설명',
      key: 'description',
      ellipsis: true,
      render: (_, { def }) => (
        <Text style={{ fontSize: 13 }}>{def.description}</Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'center' as const,
      render: (_, { name, def }) => (
        <Space size={4}>
          <Tooltip title="수정">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setTagModal({ open: true, name })}
            />
          </Tooltip>
          <Popconfirm
            title={`태그 "${name}" 삭제`}
            description="이 태그를 삭제하시겠습니까?"
            onConfirm={() => {
              deleteTag(name);
              notifySuccess('삭제 완료', `태그 ${name}이(가) 삭제되었습니다.`);
            }}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Collapse 패널 ─────────────────────────────────────────────────────────
  const collapseItems = Object.entries(tagsByCategory).map(([category, items]) => {
    const categoryLabel = tags.tagCategories[category] ?? category;
    return {
      key: category,
      label: (
        <Space>
          <Text strong>{category}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({categoryLabel})</Text>
          <Badge count={items.length} color="blue" />
        </Space>
      ),
      children: (
        <Table<{ name: string; def: TagDefinition }>
          columns={tagColumns}
          dataSource={items}
          rowKey="name"
          size="small"
          pagination={false}
          scroll={{ x: 700 }}
        />
      ),
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────────────
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
          <Title level={4} style={{ margin: 0 }}>태그 관리</Title>
          <Tag><TagsOutlined /> {tagCount}개</Tag>
        </Space>

        <Space>
          <Button icon={<ReloadOutlined />} onClick={handlePull} loading={isLoading}>
            Pull
          </Button>
          <Button icon={<ScissorOutlined />} onClick={() => setSplitOpen(true)}>
            태그 분할
          </Button>
          <Button icon={<MergeCellsOutlined />} onClick={() => setMergeOpen(true)}>
            태그 병합
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setTagModal({ open: true, name: null })}
          >
            태그 추가
          </Button>
        </Space>
      </div>

      {/* ── 태그 카테고리 카드 ───────────────────────────────────────────── */}
      <Card
        title={<Space><AppstoreOutlined />태그 카테고리</Space>}
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setCategoryModal({ open: true, id: null })}
          >
            카테고리 추가
          </Button>
        }
      >
        {categoryList.length === 0 ? (
          <Text type="secondary">Pull을 실행하면 카테고리가 표시됩니다.</Text>
        ) : (
          <Space wrap>
            {categoryList.map((id) => (
              <Tag
                key={id}
                style={{ padding: '4px 8px', cursor: 'default' }}
                closeIcon={<DeleteOutlined style={{ fontSize: 10 }} />}
                onClose={(e) => {
                  e.preventDefault();
                  deleteTagCategory(id);
                  notifySuccess('삭제 완료', `카테고리 ${id}이(가) 삭제되었습니다.`);
                }}
              >
                <Space size={4}>
                  <Text code style={{ fontSize: 11 }}>{id}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {tags.tagCategories[id]}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined style={{ fontSize: 10 }} />}
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => setCategoryModal({ open: true, id })}
                  />
                </Space>
              </Tag>
            ))}
          </Space>
        )}
      </Card>

      {/* ── 태그 목록 (카테고리별 Collapse) ─────────────────────────────── */}
      {tagCount === 0 ? (
        <Empty description="Pull을 실행하여 서버에서 태그를 불러오세요." />
      ) : (
        <Collapse
          items={collapseItems}
          defaultActiveKey={Object.keys(tagsByCategory)}
          style={{ marginBottom: 24 }}
        />
      )}

      <Divider />

      {/* ── 복합 태그 섹션 ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space>
          <Title level={5} style={{ margin: 0 }}>복합 태그 (Compound Tags)</Title>
          <Tag>{compoundCount}개</Tag>
        </Space>
        <Button
          icon={<PlusOutlined />}
          onClick={() => setCompoundModal({ open: true, name: null })}
        >
          복합 태그 추가
        </Button>
      </div>

      {compoundCount === 0 ? (
        <Empty description="복합 태그가 없습니다." />
      ) : (
        <Row gutter={[12, 12]}>
          {Object.entries(tags.compoundTags).map(([name, ct]) => (
            <Col key={name} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                title={<Text code style={{ fontSize: 12 }}>{name}</Text>}
                extra={
                  <Space size={4}>
                    <Tooltip title="수정">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => setCompoundModal({ open: true, name })}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={`복합 태그 "${name}" 삭제`}
                      onConfirm={() => {
                        deleteCompoundTag(name);
                        notifySuccess('삭제 완료', `복합 태그 ${name}이(가) 삭제되었습니다.`);
                      }}
                      okText="삭제"
                      cancelText="취소"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </Space>
                }
              >
                <Text
                  type="secondary"
                  style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                >
                  {ct.description}
                </Text>

                {ct.severity && (
                  <div style={{ marginBottom: 6 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>심각도: </Text>
                    <Tag color="red" style={{ fontSize: 11 }}>{ct.severity}</Tag>
                  </div>
                )}

                {(ct.requires ?? []).length > 0 && (
                  <div style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>필수: </Text>
                    <Space wrap size={4}>
                      {(ct.requires ?? []).map((t) => (
                        <Tag key={t} color="blue" style={{ fontSize: 11 }}>{t}</Tag>
                      ))}
                    </Space>
                  </div>
                )}

                {(ct.excludes ?? []).length > 0 && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 11 }}>제외: </Text>
                    <Space wrap size={4}>
                      {(ct.excludes ?? []).map((t) => (
                        <Tag key={t} color="orange" style={{ fontSize: 11 }}>{t}</Tag>
                      ))}
                    </Space>
                  </div>
                )}

                {ct.expression && (
                  <div style={{ marginTop: 6 }}>
                    <Text code style={{ fontSize: 11 }}>{ct.expression}</Text>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ── 모달들 ────────────────────────────────────────────────────────── */}
      <TagModal
        open={tagModal.open}
        tagName={tagModal.name}
        initial={tagModal.name ? tags.tags[tagModal.name] : undefined}
        categories={categoryList}
        onOk={handleTagOk}
        onCancel={() => setTagModal({ open: false, name: null })}
      />

      <CompoundTagModal
        open={compoundModal.open}
        tagName={compoundModal.name}
        initial={compoundModal.name ? tags.compoundTags[compoundModal.name] : undefined}
        onOk={handleCompoundOk}
        onCancel={() => setCompoundModal({ open: false, name: null })}
      />

      <CategoryModal
        open={categoryModal.open}
        catId={categoryModal.id}
        initial={categoryModal.id ? tags.tagCategories[categoryModal.id] : undefined}
        onOk={handleCategoryOk}
        onCancel={() => setCategoryModal({ open: false, id: null })}
      />

      <TagSplit open={splitOpen} onClose={() => setSplitOpen(false)} />
      <TagMerge open={mergeOpen} onClose={() => setMergeOpen(false)} />
    </div>
  );
}