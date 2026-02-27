/**
 * src/types/tag.ts
 *
 * 태그(Tag) 도메인의 모든 TypeScript 타입 정의.
 * 서버의 assets/tags/tag-definitions.json 구조를 기준으로 정의합니다.
 *
 * 태그 시스템 개요:
 * - Tier 1 태그: 정규식(regex) 또는 AST로 빠르게 추출 (LLM 불필요)
 * - Tier 2 태그: LLM 호출이 필요한 고수준 판단 태그
 * - 복합 태그(CompoundTag): Tier 1/2 태그들의 불리언 조합으로 파생되는 태그
 */

// ─────────────────────────────────────────────────────────────────────────────
// 열거형 타입
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 태그 추출 방식
 * - regex    : 정규식 패턴 매칭으로 추출
 * - ast      : Java AST(Abstract Syntax Tree) 파싱으로 추출
 * - llm      : LLM(대형 언어 모델) 호출로 판단
 */
export type TagExtractionMethod = 'regex' | 'ast' | 'llm';

/**
 * 태그 티어
 * - 1 : 빠른 추출 (정규식/AST). LLM 호출 없이 파일 스캔만으로 결정
 * - 2 : LLM 호출 필요. Tier 1 태그 결과를 기반으로 조건부 실행
 */
export type TagTier = 1 | 2;

/**
 * Detection 타입 (detection.type 필드)
 * - regex        : 정규식 기반 탐지
 * - ast          : AST 노드 기반 탐지
 * - ast_context  : AST 컨텍스트(루프 내부, finally 블록 등) 기반 탐지
 * - llm          : LLM 판단
 */
export type TagDetectionType = 'regex' | 'ast' | 'ast_context' | 'llm';

/**
 * 정규식 매치 타입
 * - any  : 패턴 중 하나라도 매칭되면 태그 할당
 * - all  : 모든 패턴이 매칭되어야 태그 할당
 * - none : 패턴이 하나도 매칭되지 않아야 태그 할당 (부정 패턴)
 */
export type TagMatchType = 'any' | 'all' | 'none';

// ─────────────────────────────────────────────────────────────────────────────
// Detection 구성 타입 (detection 필드의 세부 타입)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 정규식 기반 탐지 설정
 */
export interface RegexDetection {
  type: 'regex';
  /** 탐지에 사용할 정규식 패턴 배열 */
  patterns: string[];
  /** 패턴 매치 조건 */
  matchType: TagMatchType;
  /** 대소문자 구분 여부 (기본: true) */
  caseSensitive?: boolean;
  /** 주석 내 패턴 제외 여부 */
  excludeInComments?: boolean;
}

/**
 * AST 기반 탐지 설정
 */
export interface AstDetection {
  type: 'ast';
  /**
   * 탐지할 AST 노드 타입 또는 메트릭
   * 예: "loop", "methodCount", "cyclomaticComplexity"
   */
  nodeType?: string;
  /** 메트릭 이름 (메트릭 기반 탐지 시) */
  metric?: string;
  /** 메트릭 임계값 */
  threshold?: number;
  /** 비교 연산자 */
  operator?: '>=' | '>' | '<=' | '<' | '==';
  /** 중첩 여부 등 조건 */
  condition?: string;
}

/**
 * AST 컨텍스트 기반 탐지 설정
 * 특정 AST 노드(루프, finally 등) 내부에서 패턴을 탐지
 */
export interface AstContextDetection {
  type: 'ast_context';
  /**
   * 탐지 컨텍스트 (AST 노드 타입 또는 키워드)
   * 예: "finally", ["ForStatement", "WhileStatement", "DoStatement"]
   */
  context: string | string[];
  /** 컨텍스트 내부에서 탐지할 패턴 배열 */
  patterns: string[];
}

/**
 * LLM 기반 탐지 설정
 */
export interface LlmDetection {
  type: 'llm';
  /** LLM에게 전달할 판단 기준 (한국어 설명) */
  criteria: string;
  /**
   * 이 태그를 평가하기 위한 선행 조건 태그 배열
   * 해당 태그 중 하나라도 있는 파일에만 LLM 호출
   */
  triggerTags?: string[];
}

/** Detection 설정의 유니온 타입 */
export type TagDetection =
  | RegexDetection
  | AstDetection
  | AstContextDetection
  | LlmDetection;

// ─────────────────────────────────────────────────────────────────────────────
// 핵심 Tag 인터페이스
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 개별 태그 정의
 * tag-definitions.json의 tags[<tagName>] 값에 해당
 */
export interface TagDefinition {
  /**
   * 태그가 속한 카테고리
   * tagCategories 맵의 키 중 하나
   * 예: "structure", "resource", "pattern", "framework", "financial", "metric"
   */
  category: string;

  /** 태그 설명 (한국어) */
  description: string;

  /** 추출 방식 */
  extractionMethod: TagExtractionMethod;

  /** 태그 티어 */
  tier: TagTier;

  /** 탐지 설정 */
  detection: TagDetection;

  /** 부가 설명 (선택적, 특수 태그에 대한 메모) */
  notes?: string;
}

/**
 * 이름이 포함된 태그 정의 (목록 표시 등에 사용)
 */
export interface TagDefinitionWithName extends TagDefinition {
  /** 태그 이름 (tag-definitions.json의 키) 예: "IS_CONTROLLER" */
  name: string;
}

/**
 * 복합 태그 (Compound Tag)
 * Tier 1/2 태그들의 불리언 조합으로 파생되는 고수준 태그.
 * tag-definitions.json의 compoundTags 섹션에 정의됨.
 */
export interface CompoundTag {
  /**
   * 복합 태그 이름 (compoundTags 맵의 키)
   * 예: "RESOURCE_LEAK_RISK", "SQL_INJECTION_RISK"
   */
  name?: string;

  /** 복합 태그 설명 */
  description: string;

  /**
   * 불리언 표현식 (tag-definitions.json 형식)
   * 예: "(USES_CONNECTION || USES_STATEMENT) && !HAS_TRY_WITH_RESOURCES"
   */
  expression?: string;

  /**
   * 필수 태그 배열 (sample-pull-response.json 형식)
   * 이 태그가 모두 있어야 복합 태그 활성화
   */
  requires?: string[];

  /**
   * 제외 태그 배열 (sample-pull-response.json 형식)
   * 이 태그 중 하나라도 있으면 복합 태그 비활성화
   */
  excludes?: string[];

  /**
   * 복합 태그의 심각도
   * 예: "CRITICAL", "HIGH", "MEDIUM", "LOW"
   */
  severity?: string;
}

/**
 * 태그 데이터 전체 구조
 * Pull 응답의 tags 필드 및 Push 요청의 tags 필드에 해당
 */
export interface TagData {
  /** 태그 정의 파일의 메타데이터 */
  _metadata: TagDataMetadata;

  /**
   * 카테고리 정의 맵
   * 키: 카테고리 ID, 값: 한국어 설명
   * 예: { "structure": "클래스/메서드 구조 관련", "resource": "리소스 관리 관련" }
   */
  tagCategories: Record<string, string>;

  /**
   * 태그 정의 맵
   * 키: 태그 이름 (대문자 스네이크 케이스), 값: TagDefinition
   * 예: { "IS_CONTROLLER": { ... }, "USES_CONNECTION": { ... } }
   */
  tags: Record<string, TagDefinition>;

  /**
   * 복합 태그 정의 맵
   * 키: 복합 태그 이름, 값: CompoundTag
   * 예: { "RESOURCE_LEAK_RISK": { ... }, "SQL_INJECTION_RISK": { ... } }
   */
  compoundTags: Record<string, CompoundTag>;
}

/**
 * 태그 데이터 메타데이터
 * tag-definitions.json의 _metadata 필드
 */
export interface TagDataMetadata {
  /**
   * 태그 정의 파일 버전
   * 예: "1.0.0"
   */
  version: string;

  /** 설명 */
  description?: string;

  /**
   * 마지막 업데이트 일시 (ISO 8601)
   * 예: "2025-01-15", "2026-01-23T10:30:00.000Z"
   */
  lastUpdated: string;

  /** 전체 태그 수 */
  totalTags: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff용 태그 변경 타입 (DiffResponse에서 사용)
// ─────────────────────────────────────────────────────────────────────────────

/** Diff 응답의 tags.added 항목 */
export interface TagDiffAdded {
  /** 추가된 태그 이름 */
  name: string;
  /** 추가된 태그 정의 */
  tag: TagDefinition;
}

/** Diff 응답의 tags.modified 항목 */
export interface TagDiffModified {
  /** 수정된 태그 이름 */
  name: string;
  /** 로컬(수정 후) 태그 정의 */
  local: TagDefinition;
  /** 서버(현재) 태그 정의 */
  server: TagDefinition;
}

/** Diff 응답의 tags.deleted 항목 */
export interface TagDiffDeleted {
  /** 삭제된 태그 이름 */
  name: string;
  /** 삭제된 태그 정의 */
  tag: TagDefinition;
}

// ─────────────────────────────────────────────────────────────────────────────
// 편의 상수 및 헬퍼 타입
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 빈 TagData 초기값 (새 프로젝트 시작 시 사용)
 */
export const EMPTY_TAG_DATA: TagData = {
  _metadata: {
    version: '1.0.0',
    description: '',
    lastUpdated: new Date().toISOString(),
    totalTags: 0,
  },
  tagCategories: {},
  tags: {},
  compoundTags: {},
};

/**
 * 태그 추출 방식 한글 레이블
 */
export const TAG_EXTRACTION_METHOD_LABELS: Record<TagExtractionMethod, string> = {
  regex: '정규식',
  ast: 'AST',
  llm: 'LLM',
};

/**
 * 태그 티어 설명
 */
export const TAG_TIER_LABELS: Record<TagTier, string> = {
  1: 'Tier 1 (빠른 추출)',
  2: 'Tier 2 (LLM 필요)',
};