/**
 * src/api/dataApi.ts
 *
 * /api/data/* 엔드포인트 호출 함수 모음.
 *
 * ⚠️ Pull 응답 주의:
 *   response.rules 는 { count, items } 래퍼 구조입니다.
 *   규칙 배열은 반드시 response.rules.items 로 접근하세요.
 *
 * 참조: src/api/routes/data.routes.js, src/services/dataService.js
 */
import client from './client';
import type {
  PullResponse,
  DiffRequest,
  DiffResponse,
  PushRequest,
  PushResponse,
  StatsResponse,
} from '@/types/api';

// ─────────────────────────────────────────────────────────────────────────────
// Pull — GET /api/data/pull
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 서버에서 전체 규칙·태그 데이터를 다운로드합니다.
 *
 * 반환값의 version을 반드시 저장해두세요.
 * 이후 diffData / pushData 호출 시 baseVersion으로 사용합니다.
 *
 * @returns PullResponse
 *   - response.version         : 이후 baseVersion으로 사용
 *   - response.rules.items     : 규칙 배열 (⚠️ .items 로 접근)
 *   - response.rules.count     : 규칙 수
 *   - response.tags            : 태그 정의 전체
 */
export const pullData = async (): Promise<PullResponse> => {
  const response = await client.get<PullResponse>('/api/data/pull');
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Diff — POST /api/data/diff
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 로컬 데이터와 서버 데이터의 변경사항을 비교합니다.
 *
 * Push 전에 호출하여 추가/수정/삭제 항목을 미리 확인할 수 있습니다.
 * hasConflict가 true이면 Push 시 force 옵션이 필요합니다.
 *
 * @param payload - { baseVersion, rules, tags }
 * @returns DiffResponse — { hasConflict, rules: { added, modified, deleted }, tags: { ... } }
 */
export const diffData = async (payload: DiffRequest): Promise<DiffResponse> => {
  const response = await client.post<DiffResponse>('/api/data/diff', payload);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Push — POST /api/data/push
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 로컬 데이터를 서버에 업로드합니다.
 *
 * 서버는 Push 전 자동으로 현재 데이터를 백업합니다.
 * 버전 충돌(HTTP 409) 시 PushConflictResponse를 반환합니다 — 예외로 throw되지 않습니다.
 * isPushConflict() 타입 가드로 분기하세요.
 *
 * @param payload - { baseVersion?, rules, tags, force }
 * @returns
 *   - 성공(200):  PushSuccessResponse — { success: true, newVersion, backupPath, ... }
 *   - 충돌(409):  PushConflictResponse — { success: false, error: 'VERSION_CONFLICT', ... }
 */
export const pushData = async (payload: PushRequest): Promise<PushResponse> => {
  try {
    const response = await client.post<PushResponse>('/api/data/push', payload);
    return response.data;
  } catch (error) {
    // HTTP 409 충돌은 예외 대신 PushConflictResponse로 반환
    const err = error as { status?: number; originalError?: { response?: { data?: PushResponse } } };
    if (err.status === 409 && err.originalError?.response?.data) {
      return err.originalError.response.data;
    }
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Stats — GET /api/data/stats
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 서버의 규칙·태그 통계를 조회합니다.
 * 대시보드 위젯에서 사용합니다.
 *
 * @returns StatsResponse — { stats: { rules: { count }, tags: { count, compoundCount, categories } } }
 */
export const getStats = async (): Promise<StatsResponse> => {
  const response = await client.get<StatsResponse>('/api/data/stats');
  return response.data;
};