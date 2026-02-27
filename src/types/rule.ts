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
 * 규칙 카테고리 (9가지)
 * 서버 코드 및 sample-rules.json의 category 값을 기준으로 정의
 */
export type RuleCategory =
  | 'resource_management'   // JDBC Connection/Statement/ResultSet 리소스 관리
  | 'security'              // SQL Injection, 하드코딩 비밀번호 등
  | 'exception_handling'    // LBizException, 빈 catch, 광범위 catch 등
  | 'performance'           // N+1 쿼리, 루프 내 DB 호출 등
  | 'architecture'          // 레이어 위반, 의존성 규칙 등
  | 'code_style'            // 코드 스타일, 포매팅 등
  | 'naming_convention'     // 메서드/클래스 명명 규칙 (sel*/reg*/mod*/del*)
  | 'documentation'         // 주석, JavaDoc 등
  | 'general';              // 위 분류에 속하지 않는 일반 규칙

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

/**
 * 위반 패턴 (안티패턴)
 * LLM 또는 정규식 엔진이 위반 후보를 탐지하는 데 사용
 */
export interface AntiPattern {
  /** 정규식 문자열 (JS RegExp 형식) */
  pattern: string;
  /**
   * RegExp 플래그 문자열
   * 예: "g", "gi", "gs", "gim"
   */
  flags: string;
  /** 이 패턴이 탐지하는 내용에 대한 한국어 설명 */
  description: string;
}

/**
 * 권장 패턴 (굿패턴)
 * 규칙을 올바르게 따른 코드에서 나타나는 패턴
 */
export interface GoodPattern {
  /** 정규식 문자열 (JS RegExp 형식) */
  pattern: string;
  /**
   * RegExp 플래그 문자열
   * 예: "g", "gi"
   */
  flags: string;
  /** 이 패턴이 나타내는 올바른 구현에 대한 설명 */
  description: string;
}

/**
 * 가이드라인 문서에서 추출된 표/텍스트박스
 * Word 문서의 텍스트박스 또는 표를 파싱한 결과
 */
export interface RuleTable {
  /**
   * 원본 문서 요소 타입
   * - textbox : Word 텍스트박스
   * - table   : Word 표
   */
  type: 'textbox' | 'table';
  /** 원본 텍스트 내용 (위반/개선 사례 코드 포함) */
  content: string;
  /** Markdown으로 변환된 내용 (변환 실패 시 빈 문자열) */
  markdown: string;
  /** 표의 행 수 (textbox인 경우 1) */
  rows: number;
  /** 표의 열 수 (textbox인 경우 1) */
  cols: number;
}

/**
 * 규칙 메타데이터
 * 가이드라인 문서에서 규칙을 추출할 때 기록되는 출처 정보
 */
export interface RuleMetadata {
  /** 규칙 생성(추출) 일시 (ISO 8601 datetime) */
  createdAt: string;
  /**
   * 가이드라인 내 원본 섹션 명칭
   * 예: "7.3.1 LBizException 변환15"
   */
  source: string;
  /**
   * 원본 가이드라인 파일명
   * 예: "guideline_1.docx"
   */
  sourceFile: string;
  /**
   * 가이드라인 버전
   * 예: "4.3"
   */
  version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 핵심 Rule 인터페이스
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 코드 품질 검사 규칙
 *
 * 서버(Qdrant)에 저장되고 IntelliJ 플러그인이 사용하는 검사 단위.
 * 이 UI에서 생성·편집·삭제할 수 있으며, Push를 통해 서버에 반영됩니다.
 */
export interface Rule {
  // ── 기본 식별 ──────────────────────────────────────────────────────────────

  /**
   * 규칙 고유 ID
   * 패턴: "<sourcePrefix>.<카테고리약어>.<절번호_언더스코어>"
   * 예: "G1.ERR.7_3_1", "G1.RES.3_2_1", "G1.SEC.5_1_1"
   */
  ruleId: string;

  /**
   * 가이드라인 절 번호
   * 예: "7.3.1", "3.2.1"
   */
  sectionNumber: string;

  /** 규칙 제목 (한국어) */
  title: string;

  /**
   * 가이드라인 문서 계층 레벨 (1~4)
   * 낮을수록 상위 계층 (1=최상위 챕터, 4=세부 항목)
   */
  level: number;

  // ── 분류 ───────────────────────────────────────────────────────────────────

  /** 규칙 카테고리 */
  category: RuleCategory;

  /** 규칙 심각도 */
  severity: RuleSeverity;

  // ── 내용 ───────────────────────────────────────────────────────────────────

  /** 규칙의 상세 설명 (위험성, 발생 원인 등) */
  description: string;

  /** 위반 감지 시 사용자에게 표시할 메시지 */
  message: string;

  /** 위반 수정 방법 제안 */
  suggestion: string;

  /**
   * 검색/필터링용 키워드 배열
   * 예: ["Connection", "getConnection", "close", "try-with-resources"]
   */
  keywords: string[];

  // ── 출처 ───────────────────────────────────────────────────────────────────

  /**
   * 가이드라인 참조 문자열
   * 예: "guideline:7.3.1"
   */
  source: string;

  /**
   * 원본 가이드라인 파일명
   * 예: "guideline_1.docx"
   */
  sourceFile: string;

  /**
   * 소스 접두어 (가이드라인 문서 구분자)
   * 예: "G1", "G2"
   */
  sourcePrefix: string;

  // ── 코드 예시 ──────────────────────────────────────────────────────────────

  /**
   * 위반 코드 예시 (Java 코드 스니펫)
   * 원본 문서에 예시가 없는 경우 null
   */
  problematicCode: string | null;

  /**
   * 수정된 올바른 코드 예시 (Java 코드 스니펫)
   * 원본 문서에 예시가 없는 경우 null
   */
  fixedCode: string | null;

  // ── 문서 추출 메타 ─────────────────────────────────────────────────────────

  /** 원본 문서에 표가 포함되어 있는지 여부 */
  hasTables: boolean;

  /** 원본 문서에 이미지가 포함되어 있는지 여부 */
  hasImages: boolean;

  /**
   * 원본 문서에서 추출된 표/텍스트박스 목록
   * hasTables가 false인 경우 빈 배열
   */
  tables: RuleTable[];

  /** 규칙 추출 메타데이터 */
  metadata: RuleMetadata;

  // ── 태그/검사 관련 ─────────────────────────────────────────────────────────

  /** 검사 타입 */
  checkType: RuleCheckType;

  /**
   * checkType 선택 이유 (작성자 설명)
   * IntelliJ 플러그인 개발자를 위한 설명
   */
  checkTypeReason: string;

  /**
   * 태그 조건 표현식
   * 불리언 연산자(&&, ||, !)와 태그 이름으로 구성
   * 예: "USES_CONNECTION && !HAS_TRY_WITH_RESOURCES"
   * 예: "(IS_SERVICE || IS_CONTROLLER)"
   */
  tagCondition: string;

  /**
   * 필수 태그 배열 (tagCondition의 주요 태그)
   * 이 태그 중 하나라도 없으면 검사 대상에서 제외
   */
  requiredTags: string[];

  /**
   * 제외 태그 배열
   * 이 태그가 있으면 검사 대상에서 제외 (올바른 구현으로 간주)
   */
  excludeTags: string[];

  /**
   * 위반 후보를 탐지하는 정규식 패턴 목록
   * checkType이 pure_regex 또는 llm_with_regex일 때 주로 사용
   */
  antiPatterns: AntiPattern[];

  /**
   * 올바른 구현을 나타내는 정규식 패턴 목록
   * 이 패턴이 매칭되면 위반이 아닌 것으로 판단하는 데 활용
   */
  goodPatterns: GoodPattern[];

  // ── 상태 ───────────────────────────────────────────────────────────────────

  /**
   * 규칙 활성화 여부
   * false인 경우 IntelliJ 플러그인이 이 규칙을 검사에서 제외
   */
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 편의 타입
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 새 규칙 생성 시 사용하는 타입
 * ruleId, metadata.createdAt 등 자동 생성 필드 제외
 */
export type CreateRuleInput = Omit<Rule, 'metadata'> & {
  metadata?: Partial<RuleMetadata>;
};

/**
 * 규칙 부분 수정 타입
 * UI 폼에서 일부 필드만 수정할 때 사용
 */
export type UpdateRuleInput = Partial<Omit<Rule, 'ruleId'>>;

/**
 * 목록 페이지 필터 상태
 */
export interface RuleFilters {
  category?: RuleCategory;
  severity?: RuleSeverity;
  checkType?: RuleCheckType;
  isActive?: boolean;
  /** 검색어 (ruleId, title, description에서 검색) */
  search?: string;
}

/**
 * 카테고리 한글 레이블 맵
 */
export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  resource_management: '리소스 관리',
  security: '보안',
  exception_handling: '예외 처리',
  performance: '성능',
  architecture: '아키텍처',
  code_style: '코드 스타일',
  naming_convention: '명명 규칙',
  documentation: '문서화',
  general: '일반',
};

/**
 * 심각도 한글 레이블 맵
 */
export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  CRITICAL: '심각',
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
};

/**
 * 검사 타입 한글 레이블 맵
 */
export const RULE_CHECK_TYPE_LABELS: Record<RuleCheckType, string> = {
  pure_regex: '정규식 전용',
  llm_with_regex: 'LLM + 정규식',
  llm_contextual: 'LLM 문맥 판단',
  llm_with_ast: 'LLM + AST',
};

/**
 * 심각도별 Ant Design 색상 맵
 */
export const RULE_SEVERITY_COLORS: Record<RuleSeverity, string> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'gold',
  LOW: 'blue',
};