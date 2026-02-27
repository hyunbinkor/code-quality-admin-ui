/**
 * src/types/api.ts
 *
 * 서버 API 요청/응답 TypeScript 타입 정의.
 * 서버 코드(data.routes.js, dataService.js)의 실제 응답 구조를 기준으로 정의합니다.
 *
 * 엔드포인트:
 *   GET  /health            → HealthResponse
 *   GET  /api/data/pull     → PullResponse
 *   POST /api/data/diff     → DiffRequest → DiffResponse
 *   POST /api/data/push     → PushRequest → PushSuccessResponse | PushConflictResponse
 *   GET  /api/data/stats    → StatsResponse
 */

import type { Rule } from './rule';
import type { TagData, TagDiffAdded, TagDiffModified, TagDiffDeleted } from './tag';

// ─────────────────────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 서버 에러 코드 (공통)
 */
export type ApiErrorCode =
  | 'INVALID_DATA'      // 잘못된 데이터 형식 (HTTP 400)
  | 'VERSION_CONFLICT'  // 버전 충돌 (HTTP 409)
  | 'NOT_FOUND'         // 경로 없음 (HTTP 404)
  | 'INTERNAL_ERROR';   // 서버 내부 오류 (HTTP 500)

/**
 * 공통 에러 응답 구조
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorCode;
  message: string;
}

/**
 * Diff/Push 요약 카운트 (rules, tags 공통)
 */
export interface DiffSummary {
  addedCount: number;
  modifiedCount: number;
  deletedCount: number;
  unchangedCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health 응답
 * 서버 생존 확인용 엔드포인트
 */
export interface HealthResponse {
  /** 서버 상태 ('ok'이면 정상) */
  status: 'ok';
  /** 응답 시각 (ISO 8601 datetime) */
  timestamp: string;
  /**
   * 서버(API) 버전
   * 예: "1.0.0"
   */
  version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pull
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/data/pull 응답
 *
 * ⚠️ 주의: rules는 평탄 배열이 아닌 { count, items } 래퍼 구조입니다.
 *          반드시 response.rules.items로 접근하세요.
 */
export interface PullResponse {
  /**
   * 데이터 버전 (Unix 타임스탬프 ms)
   * Push/Diff 요청 시 baseVersion으로 재사용합니다.
   */
  version: number;

  /** Pull 실행 시각 (ISO 8601 datetime) */
  pulledAt: string;

  /**
   * 규칙 데이터
   * ⚠️ items 필드로 접근: response.rules.items
   */
  rules: {
    /** 전체 규칙 수 */
    count: number;
    /** 규칙 배열 (평탄 배열 아님 — .items로 접근) */
    items: Rule[];
  };

  /** 태그 정의 전체 */
  tags: TagData;

  /** 데이터 통계 요약 */
  metadata: {
    ruleCount: number;
    tagCount: number;
    compoundTagCount: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/data/diff 요청 바디
 */
export interface DiffRequest {
  /**
   * Pull 시 받은 version 값
   * 서버는 이 값을 기준으로 충돌 여부를 판단합니다.
   */
  baseVersion: number;

  /** 로컬에서 편집 중인 규칙 배열 */
  rules: Rule[];

  /** 로컬에서 편집 중인 태그 정의 전체 */
  tags: TagData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff 응답 세부 타입
// ─────────────────────────────────────────────────────────────────────────────

/** Diff 응답의 rules.added 항목 */
export interface RuleDiffAdded {
  ruleId: string;
  rule: Rule;
}

/** Diff 응답의 rules.modified 항목 — changes 배열 포함 */
export interface RuleDiffModified {
  ruleId: string;
  /** 로컬(편집 후) 규칙 스냅샷 (서버가 비교에 사용한 핵심 필드만 포함될 수 있음) */
  local: Partial<Rule>;
  /** 서버(현재) 규칙 스냅샷 */
  server: Partial<Rule>;
  /** 변경된 필드 목록 */
  changes: RuleFieldChange[];
}

/** Diff 응답의 rules.deleted 항목 */
export interface RuleDiffDeleted {
  ruleId: string;
  rule: Rule;
}

/** 규칙 필드 단위 변경 상세 */
export interface RuleFieldChange {
  /** 변경된 필드명 (예: "severity", "message") */
  field: string;
  /** 로컬(편집 후) 값 */
  local: unknown;
  /** 서버(현재) 값 */
  server: unknown;
}

/**
 * POST /api/data/diff 응답
 */
export interface DiffResponse {
  /** 요청에 포함된 baseVersion */
  baseVersion: number;

  /** 서버의 현재 버전 */
  currentVersion: number;

  /**
   * 버전 충돌 여부
   * baseVersion < currentVersion이면 true
   * true이더라도 Diff는 실행되며, Push 시 force 옵션이 필요합니다.
   */
  hasConflict: boolean;

  /** 규칙 변경사항 */
  rules: {
    /** 로컬에 추가된 규칙 (서버에 없음) */
    added: RuleDiffAdded[];
    /** 수정된 규칙 (서버와 다름) */
    modified: RuleDiffModified[];
    /** 삭제된 규칙 (서버에만 있음) */
    deleted: RuleDiffDeleted[];
    /** 변경 없는 규칙 ID 배열 */
    unchanged: string[];
    summary: DiffSummary;
  };

  /** 태그 변경사항 */
  tags: {
    /** 로컬에 추가된 태그 */
    added: TagDiffAdded[];
    /** 수정된 태그 */
    modified: TagDiffModified[];
    /** 삭제된 태그 */
    deleted: TagDiffDeleted[];
    /** 변경 없는 태그 이름 배열 */
    unchanged: string[];
    summary: DiffSummary;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Push
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/data/push 요청 바디
 */
export interface PushRequest {
  /**
   * Pull 시 받은 version 값 (충돌 감지용)
   * force=true인 경우 충돌 여부를 무시하고 덮어씁니다.
   */
  baseVersion?: number;

  /** 업로드할 전체 규칙 배열 (기존 서버 데이터를 완전 교체) */
  rules: Rule[];

  /** 업로드할 전체 태그 정의 (기존 서버 데이터를 완전 교체) */
  tags: TagData;

  /**
   * 버전 충돌 시 강제 덮어쓰기 여부
   * true이면 baseVersion < currentVersion이어도 Push를 허용합니다.
   * 주의: 다른 사용자의 변경이 유실될 수 있습니다.
   */
  force: boolean;
}

/**
 * POST /api/data/push 성공 응답 (HTTP 200)
 */
export interface PushSuccessResponse {
  success: true;

  /**
   * Push 후 새로 할당된 데이터 버전 (Unix 타임스탬프 ms)
   * 다음 Diff/Push 요청의 baseVersion으로 사용하세요.
   */
  newVersion: number;

  /** Push 완료 시각 (ISO 8601 datetime) */
  pushedAt: string;

  /**
   * 서버에 생성된 백업 파일 경로
   * Push 전 서버가 자동으로 현재 데이터를 백업합니다.
   */
  backupPath: string;

  /** 규칙 저장 결과 */
  rules: {
    total: number;
    success: number;
    failed: number;
  };

  /** 태그 저장 결과 */
  tags: {
    total: number;
  };
}

/**
 * POST /api/data/push 충돌 응답 (HTTP 409)
 * force=false이고 baseVersion < currentVersion인 경우 반환됩니다.
 */
export interface PushConflictResponse {
  success: false;
  error: 'VERSION_CONFLICT';
  /** 사용자에게 표시할 한국어 메시지 */
  message: string;
  /** 요청에 포함된 baseVersion */
  baseVersion: number;
  /** 서버의 현재 버전 */
  currentVersion: number;
}

/**
 * Push 응답 유니온 타입
 * 성공(200) 또는 충돌(409) 중 하나
 */
export type PushResponse = PushSuccessResponse | PushConflictResponse;

/** Push 응답이 충돌인지 타입 가드 */
export function isPushConflict(res: PushResponse): res is PushConflictResponse {
  return res.success === false && res.error === 'VERSION_CONFLICT';
}

/** Push 응답이 성공인지 타입 가드 */
export function isPushSuccess(res: PushResponse): res is PushSuccessResponse {
  return res.success === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/data/stats 응답
 */
export interface StatsResponse {
  success: true;
  stats: {
    /** 규칙 통계 */
    rules: {
      /** 전체 규칙 수 (Qdrant 포인트 수) */
      count: number;
      /**
       * Qdrant 컬렉션 상태 등 추가 정보
       * 키/값 구조는 서버 구현에 따라 다를 수 있음
       */
      status: Record<string, unknown>;
    };
    /** 태그 통계 */
    tags: {
      /** 단일 태그 수 */
      count: number;
      /** 복합 태그 수 */
      compoundCount: number;
      /**
       * 카테고리 목록 (tagCategories의 키 배열)
       * 예: ["structure", "resource", "pattern", "framework", "financial", "metric"]
       */
      categories: string[];
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB 메타데이터 타입 (idbStorage.ts에서 사용)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * IndexedDB에 저장되는 로컬 스냅샷 구조
 * 'snapshot:origin', 'snapshot:current', 'snapshot:lastPush' 슬롯에 저장
 */
export interface LocalSnapshot {
  /** 스냅샷 저장 시각 (ISO 8601 datetime) */
  savedAt: string;
  /**
   * 이 스냅샷의 기준 버전 (Pull 시 받은 version)
   * Push/Diff 요청의 baseVersion으로 사용
   */
  baseVersion: number;
  /** 규칙 배열 */
  rules: Rule[];
  /** 태그 정의 전체 */
  tags: TagData;
}

/**
 * IndexedDB에 저장되는 메타 정보 타입 맵
 * 키: meta:lastPullAt, meta:lastPushAt, meta:baseVersion
 */
export interface LocalMeta {
  'meta:lastPullAt': string | null;
  'meta:lastPushAt': string | null;
  'meta:baseVersion': number | null;
}

/** IndexedDB 슬롯 이름 (타입 안전한 상수) */
export const IDB_SLOTS = {
  ORIGIN: 'snapshot:origin',
  CURRENT: 'snapshot:current',
  LAST_PUSH: 'snapshot:lastPush',
  LAST_PULL_AT: 'meta:lastPullAt',
  LAST_PUSH_AT: 'meta:lastPushAt',
  BASE_VERSION: 'meta:baseVersion',
} as const;

export type IdbSlotKey = (typeof IDB_SLOTS)[keyof typeof IDB_SLOTS];