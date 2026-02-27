/**
 * src/api/client.ts
 *
 * axios 인스턴스 설정.
 * - baseURL: VITE_API_URL 환경변수 (기본 http://localhost:3000)
 * - 타임아웃: 30초
 * - 요청 인터셉터: Content-Type 자동 설정
 * - 응답 인터셉터: 서버 에러 코드 정규화
 */
import axios, { type AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── 요청 인터셉터 ────────────────────────────────────────────────────────────
client.interceptors.request.use(
  (config) => config,
  (error: AxiosError) => Promise.reject(error),
);

// ── 응답 인터셉터 ────────────────────────────────────────────────────────────
client.interceptors.response.use(
  // 2xx: 그대로 반환
  (response) => response,

  // 2xx 외: 에러 정규화
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;

    // 서버가 내려준 메시지가 있으면 우선 사용
    const message =
      serverMessage ??
      (status === 409 ? '버전 충돌이 발생했습니다.' :
       status === 400 ? '잘못된 요청입니다.' :
       status === 404 ? '요청한 리소스를 찾을 수 없습니다.' :
       status === 500 ? '서버 내부 오류가 발생했습니다.' :
       error.message ?? '알 수 없는 오류가 발생했습니다.');

    // 원본 에러에 정규화된 메시지 주입 후 재throw
    const normalized = new Error(message) as Error & {
      status?: number;
      code?: string;
      originalError: AxiosError;
    };
    normalized.status = status;
    normalized.code = error.response?.data?.error;
    normalized.originalError = error;

    return Promise.reject(normalized);
  },
);

export default client;