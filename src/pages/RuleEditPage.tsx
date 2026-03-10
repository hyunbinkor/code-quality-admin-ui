/**
 * src/pages/RuleEditPage.tsx
 *
 * 규칙 편집 페이지.
 * - 폼 모드 (Ant Design Form) ↔ JSON 에디터 모드 (Monaco) 전환
 * - 신규 규칙 추가 (/rules/new) 및 기존 규칙 편집 (/rules/:id)
 *
 * 변경사항 ①: requiredTags / excludeTags → Select multiple + showSearch
 * 변경사항 ②: sourcePrefix / sourceFile → AutoComplete
 * 변경사항 ③: source → AutoComplete + 필수 제거 + 빈칸 시 '직접 추가' 저장
 * 변경사항 ④: ruleId → 신규 규칙 시 자동 생성 버튼
 * 변경사항 ⑤: tagCondition → 태그/연산자 클릭 보조 버튼
 * 변경사항 ⑥: problematicCode / fixedCode → Monaco Editor (Java)
 * 변경사항 ⑦: 출처 필드를 기본 정보 Card로 통합, Form 최대 폭 1600으로 확장
 *
 * [Fix] 로컬 CATEGORY_ABBR 상수 제거 → rule.ts의 RULE_CATEGORY_ABBR import
 *   - 수정 전: RuleEditPage 내부에 9개짜리 CATEGORY_ABBR 로컬 상수 정의
 *              → 신규 카테고리 7개 누락으로 TypeScript Record 타입 불일치 에러
 *   - 수정 후: rule.ts의 RULE_CATEGORY_ABBR (16개) import하여 사용
 *              이후 카테고리 추가 시 rule.ts 한 곳만 수정하면 됨
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  Divider,
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
  Tooltip,
  Typography,
} from 'antd';
import type { InputRef } from 'antd';
import {
  ArrowLeftOutlined,
  CodeOutlined,
  DeleteOutlined,
  FormOutlined,
  PlusOutlined,
  SaveOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { Rule, RuleCategory, RuleSeverity, RuleCheckType } from '@/types/rule';
import {
  RULE_CATEGORY_LABELS,
  RULE_CATEGORY_ABBR,      // [Fix] 로컬 상수 삭제 후 여기서 import
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

// ⑤ tagCondition 연산자 버튼 목록
const TAG_OPERATORS = [
  { label: '(',  value: '(',    title: '여는 괄호' },
  { label: ')',  value: ')',    title: '닫는 괄호' },
  { label: '&&', value: ' && ', title: 'AND 조건' },
  { label: '||', value: ' || ', title: 'OR 조건' },
  { label: '!',  value: '!',    title: 'NOT 조건' },
];

// ⑥ Monaco Java 에디터 공통 옵션
const MONACO_JAVA_OPTIONS = {
  minimap:              { enabled: false },
  fontSize:             12,
  tabSize:              4,
  wordWrap:             'on'   as const,
  scrollBeyondLastLine: false,
  automaticLayout:      true,
  lineNumbers:          'on'   as const,
  folding:              false,
  renderLineHighlight:  'none' as const,
  scrollbar:            { vertical: 'auto' as const, horizontal: 'auto' as const },
};

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
// unique 값 추출 헬퍼 (②③ AutoComplete 옵션용)
// ─────────────────────────────────────────────────────────────────────────────

function toAutoCompleteOptions(rules: Rule[], field: keyof Rule) {
  const seen = new Set<string>();
  return rules
    .map((r) => r[field] as string)
    .filter((v) => typeof v === 'string' && v.trim() !== '' && v !== '직접 추가')
    .filter((v) => {
      if (seen.has(v)) return false;
      seen.add(v);
      return true;
    })
    .sort()
    .map((v) => ({ value: v }));
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ JavaCodeEditor 서브 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

interface JavaCodeEditorProps {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder: string;
}

function JavaCodeEditor({ label, value, onChange, placeholder }: JavaCodeEditorProps) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text style={{ fontSize: 13 }}>{label}</Text>
        <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Java</Tag>
      </div>
      <div
        style={{
          border:       '1px solid #d9d9d9',
          borderRadius: 6,
          overflow:     'hidden',
          minHeight:    180,
          position:     'relative',
        }}
      >
        {value === '' && (
          <div
            style={{
              position:      'absolute',
              top:           10,
              left:          60,
              color:         '#bfbfbf',
              fontSize:      12,
              fontFamily:    'monospace',
              pointerEvents: 'none',
              zIndex:        1,
            }}
          >
            {placeholder}
          </div>
        )}
        <Editor
          height="180px"
          language="java"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          options={MONACO_JAVA_OPTIONS}
        />
      </div>
    </div>
  );
}

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
  const update = (idx: number, field: keyof PatternItem, val: string) =>
    onChange(value.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  return (
    <div>
      {value.map((item, idx) => (
        <Card
          key={idx}
          size="small"
          style={{ marginBottom: 8, background: '#fafafa' }}
          title={<Text type="secondary" style={{ fontSize: 12 }}>{label} #{idx + 1}</Text>}
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
  const tags          = useDataStore((s) => s.tags);
  const isLoading     = useDataStore((s) => s.isLoading);
  const isHydrated    = useDataStore((s) => s.isHydrated);
  const baseVersion   = useDataStore((s) => s.baseVersion);
  const addRule       = useDataStore((s) => s.addRule);
  const updateRule    = useDataStore((s) => s.updateRule);
  const notifySuccess = useUiStore((s) => s.notifySuccess);
  const notifyError   = useUiStore((s) => s.notifyError);

  const [mode, setMode]                       = useState<EditMode>('form');
  const [form]                                = Form.useForm<Rule>();
  const [jsonValue, setJsonValue]             = useState('');
  const [jsonError, setJsonError]             = useState<string | null>(null);
  const [keywords, setKeywords]               = useState<string[]>([]);
  const [antiPatterns, setAntiPatterns]       = useState<PatternItem[]>([]);
  const [goodPatterns, setGoodPatterns]       = useState<PatternItem[]>([]);
  const [kwInput, setKwInput]                 = useState('');
  const [notFound, setNotFound]               = useState(false);
  const [problematicCode, setProblematicCode] = useState<string>('');
  const [fixedCode, setFixedCode]             = useState<string>('');

  // ⑤ tagCondition Input ref — 커서 위치 추적
  const tagConditionRef = useRef<InputRef>(null);

  // ① Pull된 tags.tags 키 목록 → Select 옵션
  const tagOptions = useMemo(
    () => Object.keys(tags.tags).sort().map((name) => ({ value: name, label: name })),
    [tags.tags],
  );

  // ②③ AutoComplete 옵션 — rules 배열에서 동적 추출
  const sourcePrefixOptions = useMemo(() => toAutoCompleteOptions(rules, 'sourcePrefix'), [rules]);
  const sourceFileOptions   = useMemo(() => toAutoCompleteOptions(rules, 'sourceFile'),   [rules]);
  const sourceOptions       = useMemo(() => toAutoCompleteOptions(rules, 'source'),       [rules]);

  // ─────────────────────────────────────────────────────────────────────────
  // 초기 데이터 로드
  // ─────────────────────────────────────────────────────────────────────────
  const initFromRule = useCallback(
    (rule: Rule) => {
      form.setFieldsValue(rule);
      setKeywords(rule.keywords ?? []);
      setAntiPatterns((rule.antiPatterns ?? []) as PatternItem[]);
      setGoodPatterns((rule.goodPatterns ?? []) as PatternItem[]);
      setProblematicCode(rule.problematicCode ?? '');
      setFixedCode(rule.fixedCode ?? '');
      setJsonValue(JSON.stringify(rule, null, 2));
    },
    [form],
  );

  useEffect(() => {
    if (isNew) {
      form.setFieldsValue(DEFAULT_RULE);
      setJsonValue(JSON.stringify(DEFAULT_RULE, null, 2));
      setKeywords([]);
      setAntiPatterns([]);
      setGoodPatterns([]);
      setProblematicCode('');
      setFixedCode('');
    } else {
      const found = rules.find((r) => r.ruleId === id);
      if (found) {
        setNotFound(false);
        initFromRule(found);
      } else if (isHydrated && rules.length > 0) {
        setNotFound(true);
      }
    }
  }, [id, isNew, rules, isHydrated, form, initFromRule]);

  // ─────────────────────────────────────────────────────────────────────────
  // ⑤ tagCondition 커서 삽입 헬퍼
  // ─────────────────────────────────────────────────────────────────────────
  const insertAtCursor = (text: string) => {
    const inputEl = tagConditionRef.current?.input;
    const current = (form.getFieldValue('tagCondition') as string) ?? '';
    const start   = inputEl?.selectionStart ?? current.length;
    const end     = inputEl?.selectionEnd   ?? current.length;
    const next    = current.slice(0, start) + text + current.slice(end);
    form.setFieldValue('tagCondition', next);
    requestAnimationFrame(() => {
      inputEl?.focus();
      const pos = start + text.length;
      inputEl?.setSelectionRange(pos, pos);
    });
  };

  const clearTagCondition = () => {
    form.setFieldValue('tagCondition', '');
    tagConditionRef.current?.input?.focus();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ④ ruleId 자동 생성
  //
  // [Fix] CATEGORY_ABBR(로컬 9개) → RULE_CATEGORY_ABBR(rule.ts 16개)
  //   신규 카테고리(validation, business_logic 등)가 선택된 상태에서도
  //   올바른 약어로 ruleId를 자동 생성할 수 있게 됨
  // ─────────────────────────────────────────────────────────────────────────
  const handleAutoRuleId = () => {
    const prefix   = (form.getFieldValue('sourcePrefix') as string)?.trim();
    const section  = (form.getFieldValue('sectionNumber') as string)?.trim();
    const category = form.getFieldValue('category') as RuleCategory;

    if (!prefix && !section) {
      notifyError('자동 생성 실패', '소스 프리픽스와 절 번호를 먼저 입력해주세요.');
      return;
    }
    if (!prefix) {
      notifyError('자동 생성 실패', '소스 프리픽스를 먼저 입력해주세요.');
      return;
    }
    if (!section) {
      notifyError('자동 생성 실패', '절 번호를 먼저 입력해주세요.');
      return;
    }

    // [Fix] RULE_CATEGORY_ABBR: 16개 카테고리 전체 커버
    const abbr        = RULE_CATEGORY_ABBR[category] ?? 'GEN';
    const sectionPart = section.replace(/\./g, '_');
    const generated   = `${prefix}.${abbr}.${sectionPart}`;

    if (rules.some((r) => r.ruleId === generated)) {
      notifyError('자동 생성 실패', `이미 존재하는 ruleId입니다: ${generated}`);
      return;
    }

    form.setFieldValue('ruleId', generated);
    void form.validateFields(['ruleId']);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 모드 전환
  // ─────────────────────────────────────────────────────────────────────────
  const switchToJson = () => {
    const values  = form.getFieldsValue(true) as Rule;
    const merged: Rule = {
      ...values,
      problematicCode: problematicCode.trim() || null,
      fixedCode:       fixedCode.trim()       || null,
      keywords,
      antiPatterns,
      goodPatterns,
    };
    setJsonValue(JSON.stringify(merged, null, 2));
    setJsonError(null);
    setMode('json');
  };

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

  // ─────────────────────────────────────────────────────────────────────────
  // 유효성 검사
  // ─────────────────────────────────────────────────────────────────────────
  const validate = (rule: Rule): string | null => {
    if (!rule.ruleId?.trim()) return 'ruleId는 필수입니다.';
    if (!rule.title?.trim())  return '제목은 필수입니다.';
    if (isNew && rules.some((r) => r.ruleId === rule.ruleId.trim())) {
      return `이미 존재하는 ruleId입니다: ${rule.ruleId}`;
    }
    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 저장
  // ─────────────────────────────────────────────────────────────────────────
  const handleFormSave = async () => {
    try {
      await form.validateFields();
    } catch {
      notifyError('저장 실패', '필수 항목을 확인해주세요.');
      return;
    }

    const values = form.getFieldsValue(true) as Rule;
    const rule: Rule = {
      ...values,
      source:          values.source?.trim() || '직접 추가',
      problematicCode: problematicCode.trim() || null,
      fixedCode:       fixedCode.trim()       || null,
      keywords,
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

  const handleJsonSave = () => {
    let parsed: Rule;
    try {
      parsed = JSON.parse(jsonValue) as Rule;
    } catch {
      setJsonError('JSON 형식이 올바르지 않습니다.');
      notifyError('저장 실패', 'JSON 파싱 오류');
      return;
    }

    parsed = { ...parsed, source: parsed.source?.trim() || '직접 추가' };

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

  // ─────────────────────────────────────────────────────────────────────────
  // 키워드 칩 헬퍼
  // ─────────────────────────────────────────────────────────────────────────
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

  const removeChip = (chip: string, list: string[], setList: (v: string[]) => void) =>
    setList(list.filter((t) => t !== chip));

  // ─────────────────────────────────────────────────────────────────────────
  // 가드 1: hydrate 중
  // ─────────────────────────────────────────────────────────────────────────
  if (!isHydrated || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" tip="데이터 불러오는 중..." />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 가드 2: Pull 안 한 상태에서 기존 규칙 편집 접근
  // ─────────────────────────────────────────────────────────────────────────
  if (!isNew && baseVersion === null) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rules')} style={{ marginBottom: 24 }}>
          목록으로
        </Button>
        <Result
          status="warning"
          title="데이터를 먼저 불러와야 합니다"
          subTitle="규칙을 편집하려면 서버에서 최신 데이터를 Pull 해주세요."
          extra={
            <Button type="primary" icon={<SyncOutlined />} onClick={() => navigate('/sync')}>
              동기화 페이지로 이동
            </Button>
          }
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 가드 3: 존재하지 않는 ruleId
  // ─────────────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rules')} style={{ marginBottom: 24 }}>
          목록으로
        </Button>
        <Result
          status="404"
          title="규칙을 찾을 수 없습니다"
          subTitle={
            <span>
              <Text code>{id}</Text> 에 해당하는 규칙이 로컬 데이터에 없습니다.
              <br />
              Pull을 실행하거나 규칙 ID를 확인해주세요.
            </span>
          }
          extra={
            <Space>
              <Button onClick={() => navigate('/rules')}>목록으로</Button>
              <Button type="primary" icon={<SyncOutlined />} onClick={() => navigate('/sync')}>
                동기화 페이지
              </Button>
            </Space>
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
      {/* ── 헤더 ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/rules')}>목록</Button>
          <Title level={4} style={{ margin: 0 }}>
            {isNew ? '새 규칙 추가' : `규칙 편집: ${id}`}
          </Title>
        </Space>
        <Space>
          <Segmented
            value={mode}
            onChange={handleModeChange}
            options={[
              { label: <Space><FormOutlined />폼</Space>,          value: 'form' },
              { label: <Space><CodeOutlined />JSON 에디터</Space>, value: 'json' },
            ]}
          />
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>저장</Button>
        </Space>
      </div>

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
          폼 모드  (⑦ maxWidth 1600)
      ══════════════════════════════════════════════════════════════════ */}
      {mode === 'form' && (
        <Form form={form} layout="vertical" style={{ maxWidth: 1600, width: '100%' }}>

          {/* ── 기본 정보 + 출처 (⑦ 통합) ──────────────────────────────── */}
          <Card title="기본 정보" style={{ marginBottom: 16 }}>
            <Row gutter={16}>

              {/* 규칙 ID */}
              <Col xs={24} sm={12} lg={8}>
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
                  extra={
                    isNew && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        패턴: {'<프리픽스>.<카테고리약자>.<절번호>'}  예) G1.ERR.7_3_1
                      </Text>
                    )
                  }
                >
                  <Input
                    placeholder="예: G1.ERR.7_3_1"
                    disabled={!isNew}
                    style={{ fontFamily: 'monospace' }}
                    addonAfter={
                      isNew ? (
                        <Tooltip title="소스 프리픽스 + 카테고리 + 절 번호로 자동 생성">
                          <span
                            onClick={handleAutoRuleId}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ThunderboltOutlined />
                            자동 생성
                          </span>
                        </Tooltip>
                      ) : undefined
                    }
                  />
                </Form.Item>
              </Col>

              {/* 제목 */}
              <Col xs={24} sm={12} lg={16}>
                <Form.Item
                  name="title"
                  label="제목"
                  rules={[{ required: true, message: '제목은 필수입니다.' }]}
                >
                  <Input placeholder="규칙 제목" />
                </Form.Item>
              </Col>

              {/* ⑦ 출처 필드 — 기본 정보에 통합 */}
              <Col xs={24} sm={6} lg={4}>
                <Form.Item name="sourcePrefix" label="소스 프리픽스">
                  <AutoComplete
                    options={sourcePrefixOptions}
                    placeholder="예: G1"
                    filterOption={(input, option) =>
                      (option?.value as string).toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6} lg={4}>
                <Form.Item name="sectionNumber" label="절 번호">
                  <Input placeholder="예: 7.3.1" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6} lg={6}>
                <Form.Item name="sourceFile" label="소스 파일">
                  <AutoComplete
                    options={sourceFileOptions}
                    placeholder="예: guideline_1.docx"
                    filterOption={(input, option) =>
                      (option?.value as string).toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={6} lg={6}>
                <Form.Item
                  name="source"
                  label="소스 참조"
                  extra={
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      비워두면 '직접 추가'로 저장
                    </Text>
                  }
                >
                  <AutoComplete
                    options={sourceOptions}
                    placeholder="예: guideline:7.3.1 (선택)"
                    filterOption={(input, option) =>
                      (option?.value as string).toLowerCase().includes(input.toLowerCase())
                    }
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>

              {/* 레벨 / 카테고리 / 심각도 */}
              <Col xs={12} sm={4} lg={2}>
                <Form.Item name="level" label="레벨 (1~4)">
                  <InputNumber min={1} max={4} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10} lg={6}>
                <Form.Item name="category" label="카테고리">
                  <Select>
                    {(Object.keys(RULE_CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                      <Option key={c} value={c}>{RULE_CATEGORY_LABELS[c]}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={10} lg={4}>
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

            <Form.Item name="isActive" label="활성 여부" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch checkedChildren="활성" unCheckedChildren="비활성" />
            </Form.Item>
          </Card>

          {/* ── 내용 ────────────────────────────────────────────────────── */}
          <Card title="내용" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} lg={8}>
                <Form.Item name="description" label="설명">
                  <TextArea rows={4} placeholder="규칙 상세 설명 (위험성, 발생 원인)" />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="message" label="위반 메시지">
                  <TextArea rows={4} placeholder="위반 감지 시 표시할 메시지" />
                </Form.Item>
              </Col>
              <Col xs={24} lg={8}>
                <Form.Item name="suggestion" label="개선 제안">
                  <TextArea rows={4} placeholder="위반 수정 방법" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ── 태그 / 검사 설정 ─────────────────────────────────────────── */}
          <Card title="태그 / 검사 설정" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={6}>
                <Form.Item name="checkType" label="검사 타입">
                  <Select>
                    {(Object.keys(RULE_CHECK_TYPE_LABELS) as RuleCheckType[]).map((t) => (
                      <Option key={t} value={t}>{RULE_CHECK_TYPE_LABELS[t]}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12} lg={18}>
                <Form.Item name="checkTypeReason" label="검사 타입 선택 이유">
                  <TextArea rows={1} placeholder="checkType을 선택한 이유 설명" />
                </Form.Item>
              </Col>

              {/* ⑤ tagCondition + 보조 버튼 */}
              <Col xs={24}>
                <Form.Item name="tagCondition" label="태그 조건식">
                  <Input
                    ref={tagConditionRef}
                    placeholder="예: (IS_SERVICE || IS_CONTROLLER)"
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
                <div style={{ marginTop: -12, marginBottom: 8 }}>
                  <Space size={4} wrap>
                    <Text type="secondary" style={{ fontSize: 11, marginRight: 4 }}>연산자:</Text>
                    {TAG_OPERATORS.map((op) => (
                      <Tooltip key={op.value} title={op.title}>
                        <Button
                          size="small"
                          style={{ fontFamily: 'monospace', minWidth: 36 }}
                          onClick={() => insertAtCursor(op.value)}
                        >
                          {op.label}
                        </Button>
                      </Tooltip>
                    ))}
                    <Divider type="vertical" />
                    <Button size="small" danger onClick={clearTagCondition}>지우기</Button>
                  </Space>
                </div>
                {tagOptions.length > 0 ? (
                  <div
                    style={{
                      border:       '1px solid #f0f0f0',
                      borderRadius: 6,
                      padding:      '8px 10px',
                      background:   '#fafafa',
                      marginBottom: 12,
                    }}
                  >
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                      태그 클릭 시 커서 위치에 삽입됩니다
                    </Text>
                    <Space size={[4, 4]} wrap>
                      {tagOptions.map((opt) => (
                        <Tag
                          key={opt.value}
                          color="blue"
                          style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11, userSelect: 'none' }}
                          onClick={() => insertAtCursor(opt.value)}
                        >
                          {opt.value}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ) : (
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
                    · Pull 후 태그 목록이 표시됩니다
                  </Text>
                )}
              </Col>

              {/* ① 필수 태그 */}
              <Col xs={24} sm={12}>
                <Form.Item
                  name="requiredTags"
                  label={
                    <Space size={4}>
                      필수 태그
                      <Text type="secondary" style={{ fontSize: 12 }}>(requiredTags)</Text>
                      {tagOptions.length === 0 && (
                        <Text type="warning" style={{ fontSize: 11 }}>· Pull 후 태그 목록이 표시됩니다</Text>
                      )}
                    </Space>
                  }
                >
                  <Select
                    mode="multiple"
                    showSearch
                    allowClear
                    placeholder={tagOptions.length > 0 ? '태그 검색 또는 직접 입력' : 'Pull 없이 직접 입력 가능'}
                    options={tagOptions}
                    filterOption={(input, option) =>
                      (option?.value as string).toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={
                      <Text type="secondary" style={{ fontSize: 12, padding: '4px 8px', display: 'block' }}>
                        일치하는 태그 없음 — Enter로 직접 추가
                      </Text>
                    }
                    tokenSeparators={[',']}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>

              {/* ① 제외 태그 */}
              <Col xs={24} sm={12}>
                <Form.Item
                  name="excludeTags"
                  label={
                    <Space size={4}>
                      제외 태그
                      <Text type="secondary" style={{ fontSize: 12 }}>(excludeTags)</Text>
                      {tagOptions.length === 0 && (
                        <Text type="warning" style={{ fontSize: 11 }}>· Pull 후 태그 목록이 표시됩니다</Text>
                      )}
                    </Space>
                  }
                >
                  <Select
                    mode="multiple"
                    showSearch
                    allowClear
                    placeholder={tagOptions.length > 0 ? '태그 검색 또는 직접 입력' : 'Pull 없이 직접 입력 가능'}
                    options={tagOptions}
                    filterOption={(input, option) =>
                      (option?.value as string).toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={
                      <Text type="secondary" style={{ fontSize: 12, padding: '4px 8px', display: 'block' }}>
                        일치하는 태그 없음 — Enter로 직접 추가
                      </Text>
                    }
                    tokenSeparators={[',']}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* ── 코드 예시 ────────────────────────────────────────────────── */}
          <Card title="코드 예시" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Form.Item style={{ marginBottom: 12 }}>
                  <JavaCodeEditor
                    label="위반 코드 예시 (problematicCode)"
                    value={problematicCode}
                    onChange={setProblematicCode}
                    placeholder="// 위반 코드 예시를 입력하세요"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>
                <Form.Item style={{ marginBottom: 12 }}>
                  <JavaCodeEditor
                    label="수정된 코드 예시 (fixedCode)"
                    value={fixedCode}
                    onChange={setFixedCode}
                    placeholder="// 수정된 코드 예시를 입력하세요"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} lg={12}>
                <Form.Item label="안티 패턴 (antiPatterns)">
                  <PatternEditor label="안티 패턴" value={antiPatterns} onChange={setAntiPatterns} />
                </Form.Item>
              </Col>
              <Col xs={24} lg={12}>
                <Form.Item label="올바른 패턴 (goodPatterns)">
                  <PatternEditor label="올바른 패턴" value={goodPatterns} onChange={setGoodPatterns} />
                </Form.Item>
              </Col>
            </Row>
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
            <Space.Compact style={{ width: '100%', maxWidth: 480 }}>
              <Input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onPressEnter={() => addChip(kwInput, keywords, setKeywords, setKwInput)}
                placeholder="키워드 입력 후 Enter"
              />
              <Button onClick={() => addChip(kwInput, keywords, setKeywords, setKwInput)}>추가</Button>
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
              minimap:              { enabled: false },
              fontSize:             13,
              tabSize:              2,
              wordWrap:             'on',
              scrollBeyondLastLine: false,
              automaticLayout:      true,
            }}
          />
        </Card>
      )}
    </div>
  );
}
