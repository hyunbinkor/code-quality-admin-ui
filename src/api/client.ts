/**
 * src/api/client.ts
 *
 * axios 인스턴스 설정.
 * - baseURL: VITE_API_URL 환경변수 (기본 http://localhost:3000)
 * - 타임아웃: 30초
 * - 요청 인터셉터: Content-Type 자동 설정
 * - 응답 인터셉터: 에러 코드 정규화 + 토스트 알림
 *
 * Step 14 변경사항:
 *   - 응답 인터셉터에서 에러 코드별 message.error() 토스트 표시
 *   - 예외 처리:
 *       /health    → 폴링 실패는 ServerStatus가 담당, 토스트 없음
 *       HTTP 409   → PushConfirm 컴포넌트가 별도 처리, 토스트 없음
 *       취소 요청  → axios.isCancel() → 토스트 없음
 */
import axios, { type AxiosError } from 'axios';
import { message } from 'antd';
import type { ApiErrorResponse } from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 토스트를 생략할 URL 패턴
//   /health  : usePollHealth가 서버 상태 아이콘으로 표시 → 토스트 불필요
// ─────────────────────────────────────────────────────────────────────────────
const SILENT_URL_PATTERNS = ['/health'];

function isSilentUrl(url: string | undefined): boolean {
  if (!url) return false;
  return SILENT_URL_PATTERNS.some((p) => url.includes(p));
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP 상태 코드 → 한국어 메시지 매핑
// ─────────────────────────────────────────────────────────────────────────────
function httpStatusMessage(status: number | undefined): string {
  switch (status) {
    case 400: return '잘못된 요청입니다. (400)';
    case 401: return '인증이 필요합니다. (401)';
    case 403: return '접근 권한이 없습니다. (403)';
    case 404: return '요청한 리소스를 찾을 수 없습니다. (404)';
    case 408: return '요청 시간이 초과되었습니다. (408)';
    case 500: return '서버 내부 오류가 발생했습니다. (500)';
    case 502: return '게이트웨이 오류입니다. (502)';
    case 503: return '서비스를 사용할 수 없습니다. (503)';
    default:  return status ? `서버 오류가 발생했습니다. (${status})` : '네트워크 오류가 발생했습니다.';
  }
}

// ── 요청 인터셉터 ────────────────────────────────────────────────────────────
client.interceptors.request.use(
  (config) => config,
  (error: AxiosError) => Promise.reject(error),
);

// ── 응답 인터셉터 ────────────────────────────────────────────────────────────
client.interceptors.response.use(
  // 2xx: 그대로 반환
  (response) => response,

  // 2xx 외: 에러 정규화 + 조건부 토스트
  (error: AxiosError<ApiErrorResponse>) => {
    // axios 요청 취소는 무시
    if (axios.isCancel(error)) return Promise.reject(error);

    const requestUrl = error.config?.url;
    const status     = error.response?.status;
    const serverMsg  = error.response?.data?.message;
    const errorCode  = error.response?.data?.error;

    // 최종 표시 메시지: 서버 메시지 우선, 없으면 상태 코드 기반 기본 메시지
    const displayMessage = serverMsg ?? httpStatusMessage(status);

    // ── 토스트 표시 조건 ──────────────────────────────────────────────────
    const shouldToast =
      !isSilentUrl(requestUrl) && // /health 폴링 제외
      status !== 409;             // VERSION_CONFLICT는 PushConfirm이 처리

    if (shouldToast) {
      // 네트워크 오류 (서버 무응답 등)
      if (!error.response) {
        message.error('서버에 연결할 수 없습니다. 네트워크 상태를 확인하세요.', 5);
      } else {
        message.error(displayMessage, 5);
      }
    }

    // ── 에러 객체 정규화 ─────────────────────────────────────────────────
    // catch 블록에서 err.message, err.status, err.code로 접근 가능하도록 주입
    const normalized = new Error(displayMessage) as Error & {
      status?: number;
      code?: string;
      originalError: AxiosError;
    };
    normalized.status        = status;
    normalized.code          = errorCode;
    normalized.originalError = error;

    return Promise.reject(normalized);
  },
);

export default client;