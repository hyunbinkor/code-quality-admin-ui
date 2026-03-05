/**
 * src/components/tags/TagSplit.tsx
 *
 * 태그 분할 컴포넌트.
 * 1개 태그 → 2개 새 태그로 분리하고, 해당 태그를 참조하는 규칙도 업데이트합니다.
 *
 * 개선사항:
 *   Step 0: 분할할 원본 태그 선택
 *   Step 1: 새 태그 A / B 이름 + 설정 입력
 *   Step 2: 영향받는 규칙마다 태그A / 태그B / 둘 다 / 제거 중 선택 (신규)
 *   Step 3: 최종 미리보기 & 적용
 *
 * 기존에는 모든 규칙의 참조가 무조건 태그A로 교체되었으나,
 * 이제 규칙마다 개별 선택이 가능합니다.
 */
import { useState, useMemo } from 'react';
import {
  Modal,
  Steps,
  Select,
  Form,
  Input,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Card,
  Row,
  Col,
  Divider,
  Radio,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ScissorOutlined, ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { Rule } from '@/types/rule';
import type { TagDefinition } from '@/types/tag';
import {
  findRulesUsingTag,
  replaceTagInRule,
  removeTagFromRule,
} from '@/utils/tagRefUpdate';

const { Text, Title } = Typography;
const { Option } = Select;

// ── 규칙별 태그 배정 선택지 ───────────────────────────────────────────────
type TagAssignment = 'A' | 'B' | 'BOTH' | 'REMOVE';

const ASSIGNMENT_OPTIONS: Array<{ value: TagAssignment; label: string; color: string }> = [
  { value: 'A',      label: '태그A로 교체',   color: '#1677ff' },
  { value: 'B',      label: '태그B로 교체',   color: '#52c41a' },
  { value: 'BOTH',   label: '둘 다 추가',     color: '#fa8c16' },
  { value: 'REMOVE', label: '참조 제거',       color: '#ff4d4f' },
];

interface TagSplitProps {
  open:    boolean;
  onClose: () => void;
}

interface NewTagConfig {
  name:        string;
  description: string;
}

// 규칙 미리보기 행 타입
interface PreviewRow {
  ruleId:     string;
  title:      string;
  assignment: TagAssignment;
  before:     { tagCondition: string; requiredTags: string[] };
  after:      { tagCondition: string; requiredTags: string[] };
}

export default function TagSplit({ open, onClose }: TagSplitProps) {
  const rules         = useDataStore((s) => s.rules);
  const tags          = useDataStore((s) => s.tags);
  const updateRule    = useDataStore((s) => s.updateRule);
  const upsertTag     = useDataStore((s) => s.upsertTag);
  const deleteTag     = useDataStore((s) => s.deleteTag);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [step, setStep]           = useState(0);
  const [sourceTag, setSourceTag] = useState<string | null>(null);
  const [tagA, setTagA]           = useState<NewTagConfig>({ name: '', description: '' });
  const [tagB, setTagB]           = useState<NewTagConfig>({ name: '', description: '' });
  const [formA]                   = Form.useForm();
  const [formB]                   = Form.useForm();

  // 규칙별 태그 배정 맵 (ruleId → TagAssignment)
  // 기본값: 'A' (기존 동작과 동일)
  const [assignmentMap, setAssignmentMap] = useState<Record<string, TagAssignment>>({});

  const tagNames    = Object.keys(tags.tags);
  const sourceDef: TagDefinition | null = sourceTag ? (tags.tags[sourceTag] ?? null) : null;

  // 영향받는 규칙
  const affectedRules = useMemo(
    () => (sourceTag ? findRulesUsingTag(rules, sourceTag) : []),
    [rules, sourceTag],
  );

  // Step 1 진입 시 초기 배정 맵 설정
  const initAssignmentMap = () => {
    const map: Record<string, TagAssignment> = {};
    affectedRules.forEach((r) => { map[r.ruleId] = 'A'; });
    setAssignmentMap(map);
  };

  // 특정 규칙의 배정을 변경
  const setAssignment = (ruleId: string, val: TagAssignment) => {
    setAssignmentMap((prev) => ({ ...prev, [ruleId]: val }));
  };

  // 특정 배정에 따른 after 상태 계산
  const computeAfter = (rule: Rule, assignment: TagAssignment) => {
    if (!sourceTag) return { tagCondition: rule.tagCondition ?? '', requiredTags: rule.requiredTags ?? [] };
    if (assignment === 'A') {
      const updated = replaceTagInRule(rule, sourceTag, tagA.name);
      return { tagCondition: updated.tagCondition ?? '', requiredTags: updated.requiredTags ?? [] };
    }
    if (assignment === 'B') {
      const updated = replaceTagInRule(rule, sourceTag, tagB.name);
      return { tagCondition: updated.tagCondition ?? '', requiredTags: updated.requiredTags ?? [] };
    }
    if (assignment === 'BOTH') {
      // 원본 → tagA 로 교체한 뒤, tagB도 requiredTags에 추가
      const updatedA = replaceTagInRule(rule, sourceTag, tagA.name);
      const bothRequired = [...new Set([...(updatedA.requiredTags ?? []), tagB.name])];
      return { tagCondition: updatedA.tagCondition ?? '', requiredTags: bothRequired };
    }
    // REMOVE
    const updated = removeTagFromRule(rule, sourceTag);
    return { tagCondition: updated.tagCondition ?? '', requiredTags: updated.requiredTags ?? [] };
  };

  // 미리보기 행 목록 (Step 3)
  const previewRows: PreviewRow[] = useMemo(() => {
    if (!sourceTag || !tagA.name || !tagB.name) return [];
    return affectedRules.map((rule) => {
      const assignment = assignmentMap[rule.ruleId] ?? 'A';
      const after      = computeAfter(rule, assignment);
      return {
        ruleId:     rule.ruleId,
        title:      rule.title,
        assignment,
        before: {
          tagCondition: rule.tagCondition ?? '',
          requiredTags: rule.requiredTags ?? [],
        },
        after,
      };
    });
  }, [affectedRules, sourceTag, tagA.name, tagB.name, assignmentMap]);

  // ── 유효성 검사 ─────────────────────────────────────────────────────────
  const validateStep0 = () => {
    if (!sourceTag) { notifyError('원본 태그를 선택하세요.'); return false; }
    return true;
  };

  const validateStep1 = () => {
    if (!tagA.name.trim()) { notifyError('태그 A 이름을 입력하세요.'); return false; }
    if (!tagB.name.trim()) { notifyError('태그 B 이름을 입력하세요.'); return false; }
    if (tagA.name === tagB.name) { notifyError('태그 A와 B의 이름이 같을 수 없습니다.'); return false; }
    if (tagA.name === sourceTag || tagB.name === sourceTag) {
      notifyError('새 태그 이름이 원본 태그 이름과 같을 수 없습니다.'); return false;
    }
    if (tagNames.includes(tagA.name) && tagA.name !== sourceTag) {
      notifyError(`태그 "${tagA.name}"이(가) 이미 존재합니다.`); return false;
    }
    if (tagNames.includes(tagB.name) && tagB.name !== sourceTag) {
      notifyError(`태그 "${tagB.name}"이(가) 이미 존재합니다.`); return false;
    }
    return true;
  };

  // ── 적용 ────────────────────────────────────────────────────────────────
  const handleApply = () => {
    if (!sourceTag || !sourceDef) return;
    try {
      // 1. 새 태그 A / B 생성
      const newTagA: TagDefinition = { ...sourceDef, description: tagA.description || `${sourceDef.description} (A)` };
      const newTagB: TagDefinition = { ...sourceDef, description: tagB.description || `${sourceDef.description} (B)` };
      upsertTag(tagA.name, newTagA);
      upsertTag(tagB.name, newTagB);

      // 2. 각 규칙에 선택된 배정 적용
      let updatedCount = 0;
      affectedRules.forEach((rule) => {
        const assignment = assignmentMap[rule.ruleId] ?? 'A';
        let updated: Partial<Rule>;

        if (assignment === 'A') {
          updated = replaceTagInRule(rule, sourceTag, tagA.name);
        } else if (assignment === 'B') {
          updated = replaceTagInRule(rule, sourceTag, tagB.name);
        } else if (assignment === 'BOTH') {
          const withA = replaceTagInRule(rule, sourceTag, tagA.name);
          updated = {
            ...withA,
            requiredTags: [...new Set([...(withA.requiredTags ?? []), tagB.name])],
          };
        } else {
          // REMOVE
          updated = removeTagFromRule(rule, sourceTag);
        }

        updateRule(rule.ruleId, updated);
        updatedCount++;
      });

      // 3. 원본 태그 삭제
      deleteTag(sourceTag);

      notifySuccess(
        '태그 분할 완료',
        `"${sourceTag}" → "${tagA.name}", "${tagB.name}" / ${updatedCount}개 규칙 업데이트`,
      );
      handleClose();
    } catch (err) {
      notifyError('태그 분할 실패', err instanceof Error ? err.message : undefined);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSourceTag(null);
    setTagA({ name: '', description: '' });
    setTagB({ name: '', description: '' });
    setAssignmentMap({});
    formA.resetFields();
    formB.resetFields();
    onClose();
  };

  // ── 미리보기 컬럼 ────────────────────────────────────────────────────────
  const previewColumns: ColumnsType<PreviewRow> = [
    {
      title: '규칙 ID',
      dataIndex: 'ruleId',
      width: 150,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '변경 전',
      key: 'before',
      render: (_, row) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>required: </Text>
          {row.before.requiredTags.map((t) => (
            <Tag key={t} color={t === sourceTag ? 'red' : 'blue'} style={{ fontSize: 10 }}>{t}</Tag>
          ))}
        </div>
      ),
    },
    {
      title: '',
      width: 24,
      render: () => <ArrowRightOutlined style={{ color: '#1677ff' }} />,
    },
    {
      title: '변경 후',
      key: 'after',
      render: (_, row) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>required: </Text>
          {row.after.requiredTags.map((t) => (
            <Tag key={t} color="green" style={{ fontSize: 10 }}>{t}</Tag>
          ))}
          {row.after.requiredTags.length === 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>(없음)</Text>
          )}
        </div>
      ),
    },
  ];

  // ── Step 2: 규칙별 배정 컬럼 ─────────────────────────────────────────────
  type RuleRow = { ruleId: string; title: string; requiredTags: string[] };

  const assignmentColumns: ColumnsType<RuleRow> = [
    {
      title: '규칙 ID',
      dataIndex: 'ruleId',
      width: 150,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '제목',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: (
        <Tooltip title="이 규칙의 원본 태그 참조를 어떻게 처리할지 선택하세요.">
          <Space>태그 배정 <InfoCircleOutlined /></Space>
        </Tooltip>
      ),
      key: 'assignment',
      width: 340,
      render: (_, row) => (
        <Radio.Group
          value={assignmentMap[row.ruleId] ?? 'A'}
          onChange={(e) => setAssignment(row.ruleId, e.target.value)}
          size="small"
        >
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value} style={{ fontSize: 11 }}>
              <span style={{ color: opt.color }}>{opt.label}</span>
            </Radio.Button>
          ))}
        </Radio.Group>
      ),
    },
  ];

  const affectedRuleRows: RuleRow[] = affectedRules.map((r) => ({
    ruleId:      r.ruleId,
    title:       r.title,
    requiredTags: r.requiredTags ?? [],
  }));

  // 배정 요약
  const assignmentSummary = useMemo(() => {
    const counts: Record<TagAssignment, number> = { A: 0, B: 0, BOTH: 0, REMOVE: 0 };
    Object.values(assignmentMap).forEach((v) => { counts[v]++; });
    return counts;
  }, [assignmentMap]);

  // ── 일괄 배정 버튼 ───────────────────────────────────────────────────────
  const applyAllAssignment = (val: TagAssignment) => {
    const map: Record<string, TagAssignment> = {};
    affectedRules.forEach((r) => { map[r.ruleId] = val; });
    setAssignmentMap(map);
  };

  return (
    <Modal
      title={<Space><ScissorOutlined />태그 분할</Space>}
      open={open}
      onCancel={handleClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '원본 태그 선택' },
          { title: '새 태그 설정' },
          { title: '규칙별 배정' },
          { title: '미리보기 & 적용' },
        ]}
      />

      {/* ── Step 0: 원본 태그 선택 ───────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <Form layout="vertical">
            <Form.Item label="분할할 태그 선택" required>
              <Select
                style={{ width: '100%' }}
                placeholder="태그를 선택하세요"
                value={sourceTag}
                onChange={setSourceTag}
                showSearch
                optionFilterProp="children"
              >
                {tagNames.map((name) => (
                  <Option key={name} value={name}>
                    <Space>
                      <Text code style={{ fontSize: 12 }}>{name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {tags.tags[name]?.description}
                      </Text>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>

          {sourceTag && (
            <Alert
              type="info"
              showIcon
              message={`"${sourceTag}" 태그를 참조하는 규칙: ${affectedRules.length}개`}
              description={
                affectedRules.length > 0
                  ? affectedRules.map((r) => r.ruleId).join(', ')
                  : '이 태그를 참조하는 규칙이 없습니다.'
              }
              style={{ marginTop: 12 }}
            />
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={handleClose}>취소</Button>
              <Button
                type="primary"
                onClick={() => { if (validateStep0()) setStep(1); }}
              >
                다음
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 1: 새 태그 이름/설정 ────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <Alert
            type="warning"
            showIcon
            message={`원본 태그 "${sourceTag}"은(는) 분할 후 삭제됩니다. 태그A가 기본 대체 태그입니다.`}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Card title={<Text style={{ color: '#1677ff' }}>태그 A</Text>} size="small">
                <Form form={formA} layout="vertical">
                  <Form.Item label="태그 이름" required>
                    <Input
                      placeholder="예: IS_SERVICE_IMPL"
                      value={tagA.name}
                      onChange={(e) => setTagA((p) => ({ ...p, name: e.target.value.toUpperCase() }))}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                  <Form.Item label="설명">
                    <Input
                      placeholder={sourceDef?.description + ' (A)'}
                      value={tagA.description}
                      onChange={(e) => setTagA((p) => ({ ...p, description: e.target.value }))}
                    />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
            <Col span={12}>
              <Card title={<Text style={{ color: '#52c41a' }}>태그 B</Text>} size="small">
                <Form form={formB} layout="vertical">
                  <Form.Item label="태그 이름" required>
                    <Input
                      placeholder="예: IS_SERVICE_ABSTRACT"
                      value={tagB.name}
                      onChange={(e) => setTagB((p) => ({ ...p, name: e.target.value.toUpperCase() }))}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </Form.Item>
                  <Form.Item label="설명">
                    <Input
                      placeholder={sourceDef?.description + ' (B)'}
                      value={tagB.description}
                      onChange={(e) => setTagB((p) => ({ ...p, description: e.target.value }))}
                    />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setStep(0)}>이전</Button>
              <Button onClick={handleClose}>취소</Button>
              <Button
                type="primary"
                onClick={() => {
                  if (validateStep1()) {
                    initAssignmentMap();
                    setStep(2);
                  }
                }}
              >
                {affectedRules.length > 0 ? `다음 (${affectedRules.length}개 규칙 배정)` : '미리보기'}
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 2: 규칙별 태그 배정 (신규) ─────────────────────────────── */}
      {step === 2 && (
        <div>
          {affectedRules.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="이 태그를 참조하는 규칙이 없습니다. 태그만 분할됩니다."
              style={{ marginBottom: 16 }}
            />
          ) : (
            <>
              {/* 배정 현황 */}
              <Card size="small" style={{ marginBottom: 12, background: '#f0f5ff' }}>
                <Row gutter={16} align="middle">
                  <Col>
                    <Text type="secondary" style={{ fontSize: 12 }}>배정 현황: </Text>
                    {ASSIGNMENT_OPTIONS.map((opt) => (
                      <Tag key={opt.value} color={opt.value === 'A' ? 'blue' : opt.value === 'B' ? 'green' : opt.value === 'BOTH' ? 'orange' : 'red'} style={{ fontSize: 11 }}>
                        {opt.label}: {assignmentSummary[opt.value]}개
                      </Tag>
                    ))}
                  </Col>
                  <Col style={{ marginLeft: 'auto' }}>
                    <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>일괄 적용: </Text>
                    {ASSIGNMENT_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="small"
                        style={{ marginRight: 4, fontSize: 11, color: opt.color, borderColor: opt.color }}
                        onClick={() => applyAllAssignment(opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </Col>
                </Row>
              </Card>

              <Title level={5} style={{ marginBottom: 8 }}>
                영향받는 규칙 ({affectedRules.length}개) — 각 규칙별 태그 배정 선택
              </Title>
              <Table<RuleRow>
                columns={assignmentColumns}
                dataSource={affectedRuleRows}
                rowKey="ruleId"
                size="small"
                pagination={false}
                scroll={{ y: 320 }}
              />
            </>
          )}

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStep(1)}>이전</Button>
              <Button onClick={handleClose}>취소</Button>
              <Button type="primary" onClick={() => setStep(3)}>
                미리보기
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 3: 최종 미리보기 & 적용 ─────────────────────────────────── */}
      {step === 3 && (
        <div>
          {/* 분할 요약 카드 */}
          <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary">원본 태그</Text><br />
                <Text code style={{ color: '#f5222d' }}>{sourceTag}</Text>
                <Text type="danger"> (삭제)</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">태그 A</Text><br />
                <Text code style={{ color: '#1677ff' }}>{tagA.name}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">태그 B</Text><br />
                <Text code style={{ color: '#52c41a' }}>{tagB.name}</Text>
              </Col>
            </Row>
          </Card>

          {/* 배정 요약 */}
          <Card size="small" style={{ marginBottom: 12 }}>
            <Row gutter={8}>
              {ASSIGNMENT_OPTIONS.map((opt) => (
                assignmentSummary[opt.value] > 0 && (
                  <Col key={opt.value}>
                    <Tag color={opt.value === 'A' ? 'blue' : opt.value === 'B' ? 'green' : opt.value === 'BOTH' ? 'orange' : 'red'}>
                      {opt.label}: {assignmentSummary[opt.value]}개 규칙
                    </Tag>
                  </Col>
                )
              ))}
              {affectedRules.length === 0 && (
                <Col><Text type="secondary">영향받는 규칙 없음 — 태그만 분할됩니다.</Text></Col>
              )}
            </Row>
          </Card>

          {previewRows.length > 0 && (
            <>
              <Title level={5} style={{ marginBottom: 8 }}>
                변경 미리보기 ({previewRows.length}개 규칙)
              </Title>
              <Table<PreviewRow>
                columns={previewColumns}
                dataSource={previewRows}
                rowKey="ruleId"
                size="small"
                pagination={false}
                scroll={{ y: 280 }}
              />
            </>
          )}

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStep(2)}>이전</Button>
              <Button onClick={handleClose}>취소</Button>
              <Button type="primary" danger onClick={handleApply}>
                분할 적용
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
