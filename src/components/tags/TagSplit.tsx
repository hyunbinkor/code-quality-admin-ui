/**
 * src/components/tags/TagSplit.tsx
 *
 * 태그 분할 컴포넌트.
 * 1개 태그 → 2개 새 태그로 분리하고, 해당 태그를 참조하는 규칙도 업데이트합니다.
 *
 * 흐름:
 *   1. 분할할 원본 태그 선택
 *   2. 새 태그 A / B 이름 + 설정 입력
 *   3. 영향받는 규칙 미리보기
 *   4. 적용 → dataStore 업데이트
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
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ScissorOutlined, ArrowRightOutlined } from '@ant-design/icons';
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

interface TagSplitProps {
  open: boolean;
  onClose: () => void;
}

interface NewTagConfig {
  name: string;
  description: string;
}

/** 규칙의 태그 참조 변경 미리보기 행 */
interface PreviewRow {
  ruleId: string;
  title: string;
  before: { tagCondition: string; requiredTags: string[]; excludeTags: string[] };
  after:  { tagCondition: string; requiredTags: string[]; excludeTags: string[] };
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

  const tagNames = Object.keys(tags.tags);

  // 원본 태그 정의
  const sourceDef: TagDefinition | null = sourceTag ? (tags.tags[sourceTag] ?? null) : null;

  // 영향받는 규칙
  const affectedRules = useMemo(
    () => (sourceTag ? findRulesUsingTag(rules, sourceTag) : []),
    [rules, sourceTag],
  );

  // 미리보기 데이터
  const previewRows: PreviewRow[] = useMemo(() => {
    if (!sourceTag || !tagA.name) return [];
    return affectedRules.map((rule) => {
      // 원본 태그 → 태그A로 교체 (태그B는 추가만 하므로 참조 교체는 tagA로)
      const updated = replaceTagInRule(rule, sourceTag, tagA.name);
      return {
        ruleId: rule.ruleId,
        title:  rule.title,
        before: {
          tagCondition: rule.tagCondition ?? '',
          requiredTags: rule.requiredTags ?? [],
          excludeTags:  rule.excludeTags ?? [],
        },
        after: {
          tagCondition: updated.tagCondition ?? '',
          requiredTags: updated.requiredTags ?? [],
          excludeTags:  updated.excludeTags ?? [],
        },
      };
    });
  }, [affectedRules, sourceTag, tagA.name]);

  // ── 유효성 검사 ─────────────────────────────────────────────────────────
  const validateStep1 = () => {
    if (!sourceTag) { notifyError('원본 태그를 선택하세요.'); return false; }
    return true;
  };

  const validateStep2 = () => {
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
      // 1. 새 태그 A 생성 (원본 설정 복사 + 새 description)
      const newTagA: TagDefinition = {
        ...sourceDef,
        description: tagA.description || `${sourceDef.description} (A)`,
      };
      const newTagB: TagDefinition = {
        ...sourceDef,
        description: tagB.description || `${sourceDef.description} (B)`,
      };
      upsertTag(tagA.name, newTagA);
      upsertTag(tagB.name, newTagB);

      // 2. 영향받는 규칙의 태그 참조 업데이트 (원본 → 태그A)
      affectedRules.forEach((rule) => {
        const updated = replaceTagInRule(rule, sourceTag, tagA.name);
        updateRule(rule.ruleId, updated);
      });

      // 3. 원본 태그 삭제
      deleteTag(sourceTag);

      notifySuccess(
        '태그 분할 완료',
        `"${sourceTag}" → "${tagA.name}", "${tagB.name}" / 영향 규칙 ${affectedRules.length}개 업데이트`,
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
    formA.resetFields();
    formB.resetFields();
    onClose();
  };

  // ── 미리보기 컬럼 ────────────────────────────────────────────────────────
  const previewColumns: ColumnsType<PreviewRow> = [
    {
      title: '규칙 ID',
      dataIndex: 'ruleId',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '변경 전',
      key: 'before',
      render: (_, row) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>condition: </Text>
          <Text code style={{ fontSize: 11 }}>{row.before.tagCondition || '(없음)'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>required: </Text>
          {row.before.requiredTags.map((t) => (
            <Tag key={t} color="blue" style={{ fontSize: 10 }}>{t}</Tag>
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
      title: '변경 후',
      key: 'after',
      render: (_, row) => (
        <div>
          <Text type="secondary" style={{ fontSize: 11 }}>condition: </Text>
          <Text code style={{ fontSize: 11, color: '#52c41a' }}>
            {row.after.tagCondition || '(없음)'}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>required: </Text>
          {row.after.requiredTags.map((t) => (
            <Tag key={t} color="green" style={{ fontSize: 10 }}>{t}</Tag>
          ))}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={<Space><ScissorOutlined />태그 분할</Space>}
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
          { title: '원본 태그 선택' },
          { title: '새 태그 설정' },
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
              title={`"${sourceTag}" 태그를 참조하는 규칙: ${affectedRules.length}개`}
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
                onClick={() => { if (validateStep1()) setStep(1); }}
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
            title={`원본 태그 "${sourceTag}"은(는) 분할 후 삭제됩니다. 태그A가 규칙 참조를 대체합니다.`}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              <Card
                title={<Text style={{ color: '#1677ff' }}>태그 A (규칙 참조 대체)</Text>}
                size="small"
              >
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
              <Card
                title={<Text style={{ color: '#52c41a' }}>태그 B (새로 생성)</Text>}
                size="small"
              >
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
            <Row gutter={16}>
              <Col span={8}>
                <Text type="secondary">원본 태그</Text>
                <br />
                <Text code style={{ color: '#f5222d' }}>{sourceTag}</Text>
                <Text type="danger"> (삭제)</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">태그 A (규칙 참조 대체)</Text>
                <br />
                <Text code style={{ color: '#1677ff' }}>{tagA.name}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary">태그 B (신규 생성)</Text>
                <br />
                <Text code style={{ color: '#52c41a' }}>{tagB.name}</Text>
              </Col>
            </Row>
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
              title="이 태그를 참조하는 규칙이 없습니다. 태그만 분할됩니다."
            />
          )}

          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStep(1)}>이전</Button>
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