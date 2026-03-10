/**
 * src/types/rule.ts
 *
 * 규칙(Rule) 도메인의 모든 TypeScript 타입 정의.
 * 서버의 sample-rules.json 및 Qdrant 저장 구조를 기준으로 정의합니다.
 *
 * ruleId 패턴: "<SourcePrefix>.<CategoryAbbr>.<SectionNumber_with_underscores>"
 *   예) "G1.ERR.7_3_1"  →  소스 G1, 카테고리 ERR, 절번호 7.3.1
 *       "G1.RES.3_2_1"  →  소스 G1, 카테고리 RES, 절번호 3.2.1
 */

// ─────────────────────────────────────────────────────────────────────────────
// 열거형 타입 (Literal Union)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 규칙 카테고리
 *
 * 기존 9개 + 재추출 후 추가된 7개 = 총 16개
 *
 * 기존:
 *   resource_management, security, exception_handling, performance,
 *   architecture, code_style, naming_convention, documentation, general
 *
 * 신규 (규칙 재추출로 등장):
 *   validation, business_logic, database, guideline_violation,
 *   logging, concurrency, data_integrity
 */
export type RuleCategory =
  // ── 기존 ──────────────────────────────────────────────────────────────────
  | 'resource_management'   // JDBC Connection/Statement/ResultSet 리소스 관리
  | 'security'              // SQL Injection, 하드코딩 비밀번호 등
  | 'exception_handling'    // LBizException, 빈 catch, 광범위 catch 등
  | 'performance'           // N+1 쿼리, 루프 내 DB 호출 등
  | 'architecture'          // 레이어 위반, 의존성 규칙 등
  | 'code_style'            // 코드 스타일, 포매팅 등
  | 'naming_convention'     // 메서드/클래스 명명 규칙 (sel*/reg*/mod*/del*)
  | 'documentation'         // 주석, JavaDoc 등
  | 'general'               // 위 분류에 속하지 않는 일반 규칙
  // ── 신규 ──────────────────────────────────────────────────────────────────
  | 'validation'            // 입력값/파라미터 유효성 검사
  | 'business_logic'        // 비즈니스 로직, 업무 규칙
  | 'database'              // DB 접근, 쿼리, 트랜잭션 관련
  | 'guideline_violation'   // 가이드라인 직접 위반 항목
  | 'logging'               // 로깅, 감사 추적
  | 'concurrency'           // 동시성, 스레드 안전성
  | 'data_integrity';       // 데이터 무결성, 일관성 보장

/** 규칙 심각도 (4단계) */
export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * 검사 타입
 * - pure_regex       : 정규식만으로 최종 판단 가능한 단순 패턴
 * - llm_with_regex   : 정규식으로 후보를 넓게 탐지 후 LLM이 최종 판단
 * - llm_contextual   : 코드 컨텍스트를 LLM이 직접 이해해야 판단 가능
 * - llm_with_ast     : AST 파싱 결과를 기반으로 LLM이 판단
 */
export type RuleCheckType =
  | 'pure_regex'
  | 'llm_with_regex'
  | 'llm_contextual'
  | 'llm_with_ast';

// ─────────────────────────────────────────────────────────────────────────────
// 세부 구성 인터페이스
// ─────────────────────────────────────────────────────────────────────────────

export interface AntiPattern {
  pattern: string;
  flags: string;
  description: string;
}

export interface GoodPattern {
  pattern: string;
  flags: string;
  description: string;
}

export interface RuleTable {
  type: 'textbox' | 'table';
  content: string;
  markdown: string;
  rows: number;
  cols: number;
}

export interface RuleMetadata {
  createdAt: string;
  source: string;
  sourceFile: string;
  version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 핵심 Rule 인터페이스
// ─────────────────────────────────────────────────────────────────────────────

export interface Rule {
  // ── 기본 식별 ──────────────────────────────────────────────────────────────
  ruleId: string;
  sectionNumber: string;
  title: string;
  level: number;

  // ── 분류 ───────────────────────────────────────────────────────────────────
  category: RuleCategory;
  severity: RuleSeverity;

  // ── 내용 ───────────────────────────────────────────────────────────────────
  description: string;
  message: string;
  suggestion: string;
  keywords: string[];

  // ── 출처 ───────────────────────────────────────────────────────────────────
  source: string;
  sourceFile: string;
  sourcePrefix: string;

  // ── 코드 예시 ──────────────────────────────────────────────────────────────
  problematicCode: string | null;
  fixedCode: string | null;

  // ── 문서 추출 메타 ─────────────────────────────────────────────────────────
  hasTables: boolean;
  hasImages: boolean;
  tables: RuleTable[];
  metadata: RuleMetadata;

  // ── 태그/검사 관련 ─────────────────────────────────────────────────────────
  checkType: RuleCheckType;
  checkTypeReason: string;
  tagCondition: string;
  requiredTags: string[];
  excludeTags: string[];
  antiPatterns: AntiPattern[];
  goodPatterns: GoodPattern[];

  // ── 상태 ───────────────────────────────────────────────────────────────────
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 편의 타입
// ─────────────────────────────────────────────────────────────────────────────

export type CreateRuleInput = Omit<Rule, 'metadata'> & {
  metadata?: Partial<RuleMetadata>;
};

export type UpdateRuleInput = Partial<Omit<Rule, 'ruleId'>>;

export interface RuleFilters {
  category?: RuleCategory;
  severity?: RuleSeverity;
  checkType?: RuleCheckType;
  isActive?: boolean;
  search?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 표시용 레이블 / 색상 맵
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 카테고리 한글 레이블 맵
 *
 * 기존 9개 유지 + 신규 7개 추가.
 * 서버에서 영문 category 값이 오면 이 맵으로 변환해 UI에 표시합니다.
 */
export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  // 기존
  resource_management: '리소스 관리',
  security:            '보안',
  exception_handling:  '예외 처리',
  performance:         '성능',
  architecture:        '아키텍처',
  code_style:          '코드 스타일',
  naming_convention:   '명명 규칙',
  documentation:       '문서화',
  general:             '일반',
  // 신규
  validation:          '유효성 검사',
  business_logic:      '비즈니스 로직',
  database:            '데이터베이스',
  guideline_violation: '가이드라인 위반',
  logging:             '로깅',
  concurrency:         '동시성',
  data_integrity:      '데이터 무결성',
};

/** 심각도 한글 레이블 맵 */
export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  CRITICAL: '심각',
  HIGH:     '높음',
  MEDIUM:   '보통',
  LOW:      '낮음',
};

/** 검사 타입 한글 레이블 맵 */
export const RULE_CHECK_TYPE_LABELS: Record<RuleCheckType, string> = {
  pure_regex:     '정규식 전용',
  llm_with_regex: 'LLM + 정규식',
  llm_contextual: 'LLM 문맥 판단',
  llm_with_ast:   'LLM + AST',
};

/** 심각도별 Ant Design 색상 맵 */
export const RULE_SEVERITY_COLORS: Record<RuleSeverity, string> = {
  CRITICAL: 'red',
  HIGH:     'orange',
  MEDIUM:   'gold',
  LOW:      'blue',
};

/**
 * 카테고리 약어 맵 (ruleId 자동생성용)
 * 패턴: <sourcePrefix>.<약어>.<sectionNumber_언더스코어>
 */
export const RULE_CATEGORY_ABBR: Record<RuleCategory, string> = {
  // 기존
  resource_management: 'RES',
  security:            'SEC',
  exception_handling:  'ERR',
  performance:         'PERF',
  architecture:        'ARCH',
  code_style:          'STY',
  naming_convention:   'NAM',
  documentation:       'DOC',
  general:             'GEN',
  // 신규
  validation:          'VAL',
  business_logic:      'BIZ',
  database:            'DB',
  guideline_violation: 'VIOL',
  logging:             'LOG',
  concurrency:         'CONC',
  data_integrity:      'DATA',
};