/**
 * src/pages/RuleEditPage.tsx
 *
 * 규칙 편집 페이지.
 * - 폼 모드 (Ant Design Form) ↔ JSON 에디터 모드 (Monaco) 전환
 * - 신규 규칙 추가 (/rules/new) 및 기존 규칙 편집 (/rules/:id)
 *
 * Step 14 변경사항:
 *   - isHydrated 가드: hydrate 중이면 전체 스피너 표시
 *   - baseVersion 가드: 데이터 미로드 상태에서 편집 접근 시 "Pull 먼저" 안내
 *     (신규 규칙 생성은 로컬 작업이라 허용하되, 경고 배너 표시)
 *   - 미사용 import 정리
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Result,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CodeOutlined,
  DeleteOutlined,
  FormOutlined,
  PlusOutlined,
  SaveOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { Rule, RuleCategory, RuleSeverity, RuleCheckType } from '@/types/rule';
import {
  RULE_CATEGORY_LABELS,
  RULE_SEVERITY_LABELS,
  RULE_SEVERITY_COLORS,
  RULE_CHECK_TYPE_LABELS,
} from '@/types/rule';

const { Title, Text } = Typography;
const { TextArea }    = Input;
const { Option }      = Select;

// ─────────────────────────────────────────────────────────────────────────────
// 타입 / 상수
// ─────────────────────────────────────────────────────────────────────────────

type EditMode = 'form' | 'json';

interface PatternItem {
  pattern:     string;
  flags:       string;
  description: string;
}

const EMPTY_PATTERN: PatternItem = { pattern: '', flags: 'g', description: '' };

/** 신규 규칙 기본값 */
const DEFAULT_RULE: Rule = {
  ruleId:          '',
  sectionNumber:   '',
  title:           '',
  level:           3,
  category:        'general',
  severity:        'MEDIUM',
  description:     '',
  message:         '',
  suggestion:      '',
  keywords:        [],
  source:          '',
  sourceFile:      '',
  sourcePrefix:    '',
  problematicCode: null,
  fixedCode:       null,
  hasTables:       false,
  hasImages:       false,
  tables:          [],
  metadata: {
    createdAt:  new Date().toISOString(),
    source:     '',
    sourceFile: '',
    version:    '1.0',
  },
  checkType:        'pure_regex',
  checkTypeReason:  '',
  tagCondition:     '',
  requiredTags:     [],
  excludeTags:      [],
  antiPatterns:     [],
  goodPatterns:     [],
  isActive:         true,
};

// ─────────────────────────────────────────────────────────────────────────────
// PatternEditor 서브 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

interface PatternEditorProps {
  label:    string;
  value:    PatternItem[];
  onChange: (v: PatternItem[]) => void;
}

function PatternEditor({ label, value, onChange }: PatternEditorProps) {
  const add    = () => onChange([...value, { ...EMPTY_PATTERN }]);
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof PatternItem, val: string) => {
    const next = value.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item,
    );
    onChange(next);
  };

  return (
    <div>
      {value.map((item, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 8, background: '#fafafa' }}
          title={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {label} #{idx + 1}
            </Text>
          }
          extra={
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => remove(idx)}
            />
          }
        >
          <Row gutter={8}>
            <Col span={16}>
              <Form.Item label="pattern" style={{ marginBottom: 4 }}>
                <Input
                  value={item.pattern}
                  onChange={(e) => update(idx, 'pattern', e.target.value)}
                  placeholder="정규식 문자열"
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="flags" style={{ marginBottom: 4 }}>
                <Input
                  value={item.flags}
                  onChange={(e) => update(idx, 'flags', e.target.value)}
                  placeholder="g, gi, gs..."
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="description" style={{ marginBottom: 0 }}>
            <Input
              value={item.description}
              onChange={(e) => update(idx, 'description', e.target.value)}
              placeholder="패턴 설명"
            />
          </Form.Item>
        </Card>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={add}
        size="small"
        style={{ width: '100%' }}
      >
        {label} 추가
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────

export default function RuleEditPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew    = !id || id === 'new';

  const rules         = useDataStore((s) => s.rules);
  const isLoading     = useDataStore((s) => s.isLoading);
  const isHydrated    = useDataStore((s) => s.isHydrated);
  const baseVersion   = useDataStore((s) => s.baseVersion);
  const addRule       = useDataStore((s) => s.addRule);
  const updateRule    = useDataStore((s) => s.updateRule);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [mode, setMode]                 = useState<EditMode>('form');
  const [form]                          = Form.useForm<Rule>();
  const [jsonValue, setJsonValue]       = useState('');
  const [jsonError, setJsonError]       = useState<string | null>(null);
  const [keywords, setKeywords]         = useState<string[]>([]);
  const [requiredTags, setRequiredTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags]   = useState<string[]>([]);
  const [antiPatterns, setAntiPatterns] = useState<PatternItem[]>([]);
  const [goodPatterns, setGoodPatterns] = useState<PatternItem[]>([]);
  const [kwInput, setKwInput]   = useState('');
  const [reqInput, setReqInput] = useState('');
  const [excInput, setExcInput] = useState('');

  // ── 초기 데이터 로드 ────────────────────────────────────────────────────
  const initFromRule = useCallback(
    (rule: Rule) => {
      form.setFieldsValue(rule);
      setKeywords(rule.keywords ?? []);
      setRequiredTags(rule.requiredTags ?? []);
      setExcludeTags(rule.excludeTags ?? []);
      setAntiPatterns((rule.antiPatterns ?? []) as PatternItem[]);
      setGoodPatterns((rule.goodPatterns ?? []) as PatternItem[]);
      setJsonValue(JSON.stringify(rule, null, 2));
    },
    [form],
  );

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue(DEFAULT_RULE);
      setJsonValue(JSON.stringify(DEFAULT_RULE, null, 2));
      setKeywords([]);
      setRequiredTags([]);
      setExcludeTags([]);
      setAntiPatterns([]);
      setGoodPatterns([]);
    } else {
      const found = rules.find((r) => r.ruleId === id);
      if (found) {
        initFromRule(found);
      } else if (isHydrated && rules.length > 0) {
        // hydrate 완료 후에도 못 찾으면 목록으로 이동
        notifyError('규칙을 찾을 수 없습니다.', `ruleId: ${id}`);
        navigate('/rules');
      }
    }
  }, [id, isNew, rules, isHydrated, form, initFromRule, navigate, notifyError]);

  // ── 모드 전환: 폼 → JSON ─────────────────────────────────────────────────
  const switchToJson = () => {
    const values  = form.getFieldsValue(true) as Rule;
    const merged: Rule = {
      ...values,
      keywords,
      requiredTags,
      excludeTags,
      antiPatterns,
      goodPatterns,
    };
    setJsonValue(JSON.stringify(merged, null, 2));
    setJsonError(null);
    setMode('json');
  };

  // ── 모드 전환: JSON → 폼 ─────────────────────────────────────────────────
  const switchToForm = () => {
    try {
      const parsed = JSON.parse(jsonValue) as Rule;
      initFromRule(parsed);
      setJsonError(null);
      setMode('form');
    } catch {
      setJsonError('JSON 형식이 올바르지 않습니다. 수정 후 다시 시도하세요.');
    }
  };

  const handleModeChange = (val: string | number) => {
    if (val === 'json') switchToJson();
    else switchToForm();
  };

  // ── 유효성 검사 ──────────────────────────────────────────────────────────
  const validate = (rule: Rule): string | null => {
    if (!rule.ruleId?.trim()) return 'ruleId는 필수입니다.';
    if (!rule.title?.trim())  return '제목은 필수입니다.';
    if (isNew && rules.some((r) => r.ruleId === rule.ruleId.trim())) {
      return `이미 존재하는 ruleId입니다: ${rule.ruleId}`;
    }
    return null;
  };

  // ── 저장 (폼 모드) ────────────────────────────────────────────────────────
  const handleFormSave = async () => {
    try {
      await form.validateFields();
    } catch {
      notifyError('저장 실패', '필수 항목을 확인해주세요.');
      return;
    }

    const values  = form.getFieldsValue(true) as Rule;
    const rule: Rule = {
      ...values,
      keywords,
      requiredTags,
      excludeTags,
      antiPatterns,
      goodPatterns,
      metadata: {
        ...(values.metadata ?? DEFAULT_RULE.metadata),
        createdAt: isNew
          ? new Date().toISOString()
          : (values.metadata?.createdAt ?? new Date().toISOString()),
      },
    };

    const err = validate(rule);
    if (err) { notifyError('저장 실패', err); return; }

    if (isNew) {
      addRule(rule);
      notifySuccess('규칙 추가 완료', `${rule.ruleId} 규칙이 추가되었습니다.`);
      navigate(`/rules/${rule.ruleId}`);
    } else {
      updateRule(rule.ruleId, rule);
      notifySuccess('저장 완료', `${rule.ruleId} 규칙이 저장되었습니다.`);
    }
  };

  // ── 저장 (JSON 모드) ──────────────────────────────────────────────────────
  const handleJsonSave = () => {
    let parsed: Rule;
    try {
      parsed = JSON.parse(jsonValue) as Rule;
    } catch {
      setJsonError('JSON 형식이 올바르지 않습니다.');
      notifyError('저장 실패', 'JSON 파싱 오류');
      return;
    }

    const err = validate(parsed);
    if (err) { setJsonError(err); notifyError('저장 실패', err); return; }

    setJsonError(null);
    if (isNew) {
      addRule(parsed);
      notifySuccess('규칙 추가 완료', `${parsed.ruleId} 규칙이 추가되었습니다.`);
      navigate(`/rules/${parsed.ruleId}`);
    } else {
      updateRule(parsed.ruleId, parsed);
      notifySuccess('저장 완료', `${parsed.ruleId} 규칙이 저장되었습니다.`);
    }
  };

  const handleSave = () => (mode === 'form' ? handleFormSave() : handleJsonSave());

  // ── 태그 칩 입력 헬퍼 ────────────────────────────────────────────────────
  const addChip = (
    val: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
  ) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
    setInput('');
  };

  const removeChip = (
    chip: string,
    list: string[],
    setList: (v: string[]) => void,
  ) => setList(list.filter((t) => t !== chip));

  // ─────────────────────────────────────────────────────────────────────────
  // ── 가드 1: hydrate 중 스피너 ────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  if (!isHydrated || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh',
        }}
      >
        <Spin size="large" tip="데이터 불러오는 중..." />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ── 가드 2: 편집 모드에서 데이터 미로드 (Pull 안 함) ─────────────────────
  //    신규 규칙 생성은 로컬 작업이므로 허용 (경고 배너만 표시)
  // ─────────────────────────────────────────────────────────────────────────
  if (!isNew && baseVersion === null) {
    return (
      <div>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/rules')}
          style={{ marginBottom: 24 }}
        >
          목록으로
        </Button>
        <Result
          status="warning"
          title="데이터를 먼저 불러와야 합니다"
          subTitle="규칙을 편집하려면 서버에서 최신 데이터를 Pull 해주세요."
          extra={
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => navigate('/sync')}
            >
              동기화 페이지로 이동
            </Button>
          }
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── 헤더 ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   24,
        }}
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rules')}>
            목록
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? '새 규칙 추가' : `규칙 편집: ${id}`}
          </Title>
        </Space>

        <Space>
          <Segmented
            value={mode}
            onChange={handleModeChange}
            options={[
              { label: <Space><FormOutlined />폼</Space>,         value: 'form' },
              { label: <Space><CodeOutlined />JSON 에디터</Space>, value: 'json' },
            ]}
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            저장
          </Button>
        </Space>
      </div>

      {/* 신규 규칙이지만 Pull 데이터 없는 경우 소프트 경고 */}
      {isNew && baseVersion === null && (
        <Alert
          type="warning"
          showIcon
          message="Pull 데이터 없음"
          description="로컬에 서버 데이터가 없습니다. 규칙을 추가할 수 있지만, 서버에 반영하려면 나중에 Pull → Push 순서로 진행하세요."
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── JSON 에러 알림 ─────────────────────────────────────────────────── */}
      {jsonError && (
        <Alert
          type="error"
          message={jsonError}
          closable
          onClose={() => setJsonError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          폼 모드
      ══════════════════════════════════════════════════════════════════ */}
      {mode === 'form' && (
        <Form form={form} layout="vertical" style={{ maxWidth: 900 }}>

          {/* ── 기본 정보 ───────────────────────────────────────────────── */}
          <Card title="기본 정보" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="ruleId"
                  label="규칙 ID"
                  rules={[
                    { required: true, message: 'ruleId는 필수입니다.' },
                    {
                      validator: (_, value: string) => {
                        if (!isNew) return Promise.resolve();
                        if (value && rules.some((r) => r.ruleId === value)) {
                          return Promise.reject('이미 존재하는 ruleId입니다.');
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input
                    placeholder="예: G1.ERR.7_3_1"
                    disabled={!isNew}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="title"
                  label="제목"
                  rules={[{ required: true, message: '제목은 필수입니다.' }]}
                >
                  <Input placeholder="규칙 제목" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="sectionNumber" label="절 번호">
                  <Input placeholder="예: 7.3.1" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={4}>
                <Form.Item name="level" label="레벨 (1~4)">
                  <InputNumber min={1} max={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item name="category" label="카테고리">
                  <Select>
                    {(Object.keys(RULE_CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                      <Option key={c} value={c}>{RULE_CATEGORY_LABELS[c]}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={6}>
                <Form.Item name="severity" label="심각도">
                  <Select>
                    {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RuleSeverity[]).map((s) => (
                      <Option key={s} value={s}>
                        <Tag color={RULE_SEVERITY_COLORS[s]}>{RULE_SEVERITY_LABELS[s]}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="isActive" label="활성 여부" valuePropName="checked">
              <Switch checkedChildren="활성" unCheckedChildren="비활성" />
            </Form.Item>
          </Card>

          {/* ── 내용 ────────────────────────────────────────────────────── */}
          <Card title="내용" style={{ marginBottom: 16 }}>
            <Form.Item name="description" label="설명">
              <TextArea rows={3} placeholder="규칙 상세 설명 (위험성, 발생 원인)" />
            </Form.Item>
            <Form.Item name="message" label="위반 메시지">
              <TextArea rows={2} placeholder="위반 감지 시 표시할 메시지" />
            </Form.Item>
            <Form.Item name="suggestion" label="개선 제안">
              <TextArea rows={2} placeholder="위반 수정 방법" />
            </Form.Item>
          </Card>

          {/* ── 출처 ────────────────────────────────────────────────────── */}
          <Card title="출처" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="sourcePrefix" label="소스 프리픽스">
                  <Input placeholder="예: G1" style={{ fontFamily: 'monospace' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="sourceFile" label="소스 파일">
                  <Input placeholder="예: guideline_1.docx" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="source" label="소스 참조">
                  <Input placeholder="예: guideline:7.3.1" style={{ fontFamily: 'monospace' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ── 태그 / 검사 설정 ───────────────────────────────────────── */}
          <Card title="태그 / 검사 설정" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="checkType" label="검사 타입">
                  <Select>
                    {(Object.keys(RULE_CHECK_TYPE_LABELS) as RuleCheckType[]).map((t) => (
                      <Option key={t} value={t}>{RULE_CHECK_TYPE_LABELS[t]}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="tagCondition" label="태그 조건식">
                  <Input
                    placeholder="예: (IS_SERVICE || IS_CONTROLLER)"
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="checkTypeReason" label="검사 타입 선택 이유">
              <TextArea rows={2} placeholder="checkType을 선택한 이유 설명" />
            </Form.Item>

            {/* 필수 태그 */}
            <Form.Item label="필수 태그 (requiredTags)">
              <Space wrap style={{ marginBottom: 8 }}>
                {requiredTags.map((t) => (
                  <Tag
                    key={t}
                    closable
                    onClose={() => removeChip(t, requiredTags, setRequiredTags)}
                    color="blue"
                  >
                    {t}
                  </Tag>
                ))}
              </Space>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={reqInput}
                  onChange={(e) => setReqInput(e.target.value)}
                  onPressEnter={() => addChip(reqInput, requiredTags, setRequiredTags, setReqInput)}
                  placeholder="태그 이름 입력 후 Enter"
                  style={{ fontFamily: 'monospace' }}
                />
                <Button onClick={() => addChip(reqInput, requiredTags, setRequiredTags, setReqInput)}>
                  추가
                </Button>
              </Space.Compact>
            </Form.Item>

            {/* 제외 태그 */}
            <Form.Item label="제외 태그 (excludeTags)">
              <Space wrap style={{ marginBottom: 8 }}>
                {excludeTags.map((t) => (
                  <Tag
                    key={t}
                    closable
                    onClose={() => removeChip(t, excludeTags, setExcludeTags)}
                    color="red"
                  >
                    {t}
                  </Tag>
                ))}
              </Space>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={excInput}
                  onChange={(e) => setExcInput(e.target.value)}
                  onPressEnter={() => addChip(excInput, excludeTags, setExcludeTags, setExcInput)}
                  placeholder="태그 이름 입력 후 Enter"
                  style={{ fontFamily: 'monospace' }}
                />
                <Button onClick={() => addChip(excInput, excludeTags, setExcludeTags, setExcInput)}>
                  추가
                </Button>
              </Space.Compact>
            </Form.Item>
          </Card>

          {/* ── 코드 예시 ────────────────────────────────────────────────── */}
          <Card title="코드 예시" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="위반 코드 예시 (problematicCode)">
                  <TextArea
                    rows={5}
                    placeholder="위반 코드 예시 (Java)"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    value={form.getFieldValue('problematicCode') ?? ''}
                    onChange={(e) => form.setFieldValue('problematicCode', e.target.value || null)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="수정된 코드 예시 (fixedCode)">
                  <TextArea
                    rows={5}
                    placeholder="수정된 코드 예시 (Java)"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    value={form.getFieldValue('fixedCode') ?? ''}
                    onChange={(e) => form.setFieldValue('fixedCode', e.target.value || null)}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="안티 패턴 (antiPatterns)">
              <PatternEditor label="안티 패턴" value={antiPatterns} onChange={setAntiPatterns} />
            </Form.Item>

            <Form.Item label="올바른 패턴 (goodPatterns)">
              <PatternEditor label="올바른 패턴" value={goodPatterns} onChange={setGoodPatterns} />
            </Form.Item>
          </Card>

          {/* ── 키워드 ──────────────────────────────────────────────────── */}
          <Card title="키워드" style={{ marginBottom: 16 }}>
            <Space wrap style={{ marginBottom: 8 }}>
              {keywords.map((kw) => (
                <Tag key={kw} closable onClose={() => removeChip(kw, keywords, setKeywords)}>
                  {kw}
                </Tag>
              ))}
            </Space>
            <Space.Compact style={{ width: '100%', maxWidth: 400 }}>
              <Input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onPressEnter={() => addChip(kwInput, keywords, setKeywords, setKwInput)}
                placeholder="키워드 입력 후 Enter"
              />
              <Button onClick={() => addChip(kwInput, keywords, setKeywords, setKwInput)}>
                추가
              </Button>
            </Space.Compact>
          </Card>
        </Form>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          JSON 에디터 모드
      ══════════════════════════════════════════════════════════════════ */}
      {mode === 'json' && (
        <Card
          title="JSON 편집"
          size="small"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              저장 버튼을 누르면 JSON을 파싱하여 규칙을 업데이트합니다.
            </Text>
          }
        >
          <Editor
            height="600px"
            language="json"
            value={jsonValue}
            onChange={(v) => setJsonValue(v ?? '')}
            options={{
              minimap:             { enabled: false },
              fontSize:            13,
              tabSize:             2,
              wordWrap:            'on',
              scrollBeyondLastLine: false,
              automaticLayout:     true,
            }}
          />
        </Card>
      )}
    </div>
  );
}