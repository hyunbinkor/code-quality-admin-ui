/**
 * src/components/tags/TagMerge.tsx
 *
 * 태그 병합 컴포넌트.
 * N개 태그 → 1개 새 태그로 통합하고, 규칙의 태그 참조를 모두 업데이트합니다.
 *
 * 흐름:
 *   1. 병합할 태그들 체크박스 선택 (2개 이상)
 *   2. 새 태그 이름/설정 입력
 *   3. 영향받는 규칙 미리보기
 *   4. 적용 → dataStore 업데이트
 */
import { useState, useMemo } from 'react';
import {
  Modal,
  Steps,
  Checkbox,
  Form,
  Input,
  Select,
  Button,
  Space,
  Table,
  Tag,
  Typography,
  Alert,
  Card,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { MergeCellsOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { TagDefinition, TagExtractionMethod, TagTier } from '@/types/tag';
import {
  TAG_EXTRACTION_METHOD_LABELS,
} from '@/types/tag';
import {
  findRulesUsingAnyTag,
  mergeTagsInRule,
} from '@/utils/tagRefUpdate';

const { Text, Title } = Typography;
const { Option } = Select;

interface TagMergeProps {
  open: boolean;
  onClose: () => void;
}

interface NewTagConfig {
  name: string;
  description: string;
  extractionMethod: TagExtractionMethod;
  tier: TagTier;
}

interface PreviewRow {
  ruleId: string;
  title: string;
  beforeCondition: string;
  afterCondition: string;
  beforeRequired: string[];
  afterRequired: string[];
}

export default function TagMerge({ open, onClose }: TagMergeProps) {
  const rules         = useDataStore((s) => s.rules);
  const tags          = useDataStore((s) => s.tags);
  const updateRule    = useDataStore((s) => s.updateRule);
  const upsertTag     = useDataStore((s) => s.upsertTag);
  const deleteTag     = useDataStore((s) => s.deleteTag);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [step, setStep]               = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag]           = useState<NewTagConfig>({
    name: '',
    description: '',
    extractionMethod: 'regex',
    tier: 1,
  });

  const tagNames = Object.keys(tags.tags);

  // 영향받는 규칙
  const affectedRules = useMemo(
    () => (selectedTags.length > 0 ? findRulesUsingAnyTag(rules, selectedTags) : []),
    [rules, selectedTags],
  );

  // 미리보기
  const previewRows: PreviewRow[] = useMemo(() => {
    if (!newTag.name || selectedTags.length === 0) return [];
    return affectedRules.map((rule) => {
      const updated = mergeTagsInRule(rule, selectedTags, newTag.name);
      return {
        ruleId:          rule.ruleId,
        title:           rule.title,
        beforeCondition: rule.tagCondition ?? '',
        afterCondition:  updated.tagCondition ?? '',
        beforeRequired:  rule.requiredTags ?? [],
        afterRequired:   updated.requiredTags ?? [],
      };
    });
  }, [affectedRules, selectedTags, newTag.name]);

  // ── 유효성 검사 ─────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (selectedTags.length < 2) {
      notifyError('2개 이상의 태그를 선택하세요.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!newTag.name.trim()) {
      notifyError('새 태그 이름을 입력하세요.');
      return false;
    }
    const existsAndNotSource =
      tagNames.includes(newTag.name) && !selectedTags.includes(newTag.name);
    if (existsAndNotSource) {
      notifyError(`태그 "${newTag.name}"이(가) 이미 존재합니다.`);
      return false;
    }
    return true;
  };

  // ── 적용 ────────────────────────────────────────────────────────────────
  const handleApply = () => {
    try {
      // 1. 새 태그 생성 (첫 번째 선택 태그의 설정을 기반으로)
      const baseDef = tags.tags[selectedTags[0]];
      const merged: TagDefinition = {
        category:         baseDef?.category ?? 'general',
        description:      newTag.description || selectedTags.join(' + '),
        extractionMethod: newTag.extractionMethod,
        tier:             newTag.tier,
        detection:        baseDef?.detection ?? { type: 'regex', patterns: [], matchType: 'any' },
      };
      upsertTag(newTag.name, merged);

      // 2. 영향받는 규칙 업데이트
      affectedRules.forEach((rule) => {
        const updated = mergeTagsInRule(rule, selectedTags, newTag.name);
        updateRule(rule.ruleId, updated);
      });

      // 3. 원본 태그들 삭제
      selectedTags.forEach((t) => deleteTag(t));

      notifySuccess(
        '태그 병합 완료',
        `${selectedTags.join(', ')} → "${newTag.name}" / 영향 규칙 ${affectedRules.length}개 업데이트`,
      );
      handleClose();
    } catch (err) {
      notifyError('태그 병합 실패', err instanceof Error ? err.message : undefined);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSelectedTags([]);
    setNewTag({ name: '', description: '', extractionMethod: 'regex', tier: 1 });
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
      title: '변경 전 condition',
      key: 'before',
      render: (_, row) => (
        <div>
          <Text code style={{ fontSize: 11 }}>{row.beforeCondition || '(없음)'}</Text>
          <br />
          {row.beforeRequired.map((t) => (
            <Tag key={t} color={selectedTags.includes(t) ? 'orange' : 'blue'} style={{ fontSize: 10 }}>
              {t}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '',
      width: 32,
      render: () => <ArrowRightOutlined style={{ color: '#1677ff' }} />,
    },
    {
      title: '변경 후 condition',
      key: 'after',
      render: (_, row) => (
        <div>
          <Text code style={{ fontSize: 11, color: '#52c41a' }}>
            {row.afterCondition || '(없음)'}
          </Text>
          <br />
          {row.afterRequired.map((t) => (
            <Tag key={t} color="green" style={{ fontSize: 10 }}>{t}</Tag>
          ))}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={<Space><MergeCellsOutlined />태그 병합</Space>}
      open={open}
      onCancel={handleClose}
      width={820}
      footer={null}
      destroyOnHidden
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '병합할 태그 선택' },
          { title: '새 태그 설정' },
          { title: '미리보기 & 적용' },
        ]}
      />

      {/* ── Step 0: 병합할 태그 선택 ────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <Alert
            type="info"
            showIcon
            title="2개 이상의 태그를 선택하면 하나로 병합합니다. 원본 태그들은 삭제됩니다."
            style={{ marginBottom: 16 }}
          />

          <div
            style={{
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              padding: 12,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            <Checkbox.Group
              value={selectedTags}
              onChange={(vals) => setSelectedTags(vals as string[])}
              style={{ width: '100%' }}
            >
              {tagNames.map((name) => {
                const def = tags.tags[name];
                return (
                  <div
                    key={name}
                    style={{
                      padding: '6px 8px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Checkbox value={name} />
                    <Text code style={{ fontSize: 12, minWidth: 180 }}>{name}</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{def?.category}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{def?.description}</Text>
                  </div>
                );
              })}
            </Checkbox.Group>
          </div>

          {selectedTags.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`선택된 ${selectedTags.length}개 태그를 참조하는 규칙: ${affectedRules.length}개`}
              description={affectedRules.map((r) => r.ruleId).join(', ') || '없음'}
              style={{ marginTop: 12 }}
            />
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={handleClose}>취소</Button>
              <Button
                type="primary"
                disabled={selectedTags.length < 2}
                onClick={() => { if (validateStep1()) setStep(1); }}
              >
                다음 ({selectedTags.length}개 선택됨)
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 1: 새 태그 설정 ─────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <Card size="small" style={{ marginBottom: 16, background: '#fff7e6' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>병합 대상: </Text>
            <Space wrap size={4}>
              {selectedTags.map((t) => (
                <Tag key={t} color="orange" style={{ fontSize: 11 }}>{t}</Tag>
              ))}
            </Space>
          </Card>

          <Form layout="vertical">
            <Form.Item label="새 태그 이름" required>
              <Input
                placeholder="예: IS_SPRING_COMPONENT"
                value={newTag.name}
                onChange={(e) => setNewTag((p) => ({ ...p, name: e.target.value.toUpperCase() }))}
                style={{ fontFamily: 'monospace', maxWidth: 300 }}
              />
            </Form.Item>
            <Form.Item label="설명">
              <Input
                placeholder="병합된 태그 설명"
                value={newTag.description}
                onChange={(e) => setNewTag((p) => ({ ...p, description: e.target.value }))}
              />
            </Form.Item>
            <Space size={16}>
              <Form.Item label="추출 방식" style={{ marginBottom: 0 }}>
                <Select
                  value={newTag.extractionMethod}
                  onChange={(v) => setNewTag((p) => ({ ...p, extractionMethod: v }))}
                  style={{ width: 140 }}
                >
                  {(Object.keys(TAG_EXTRACTION_METHOD_LABELS) as TagExtractionMethod[]).map((m) => (
                    <Option key={m} value={m}>{TAG_EXTRACTION_METHOD_LABELS[m]}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="티어" style={{ marginBottom: 0 }}>
                <Select
                  value={newTag.tier}
                  onChange={(v) => setNewTag((p) => ({ ...p, tier: v as TagTier }))}
                  style={{ width: 160 }}
                >
                  <Option value={1}>Tier 1 (빠른 추출)</Option>
                  <Option value={2}>Tier 2 (LLM)</Option>
                </Select>
              </Form.Item>
            </Space>
          </Form>

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setStep(0)}>이전</Button>
              <Button onClick={handleClose}>취소</Button>
              <Button
                type="primary"
                onClick={() => { if (validateStep2()) setStep(2); }}
              >
                미리보기
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 2: 미리보기 & 적용 ──────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Space wrap size={4}>
              {selectedTags.map((t) => (
                <Tag key={t} color="orange" style={{ fontSize: 11 }}>{t}</Tag>
              ))}
              <Text>→</Text>
              <Tag color="green" style={{ fontSize: 12 }}>{newTag.name}</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>(원본 태그 {selectedTags.length}개 삭제)</Text>
            </Space>
          </Card>

          {previewRows.length > 0 ? (
            <>
              <Title level={5} style={{ marginBottom: 8 }}>
                영향받는 규칙 ({previewRows.length}개) — 태그 참조 변경 미리보기
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
          ) : (
            <Alert
              type="info"
              showIcon
              title="영향받는 규칙이 없습니다. 태그만 병합됩니다."
            />
          )}

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStep(1)}>이전</Button>
              <Button onClick={handleClose}>취소</Button>
              <Button type="primary" danger onClick={handleApply}>
                병합 적용
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}