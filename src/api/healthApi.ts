/**
 * src/api/healthApi.ts
 *
 * GET /health 엔드포인트 호출.
 * 서버 생존 확인용. 대시보드에서 30초 간격 폴링에 사용됩니다.
 */
import client from './client';
import type { HealthResponse } from '@/types/api';

/**
 * 서버 연결 상태 확인
 * @returns HealthResponse — { status: 'ok', timestamp, version }
 * @throws 서버 미응답 또는 에러 시 예외 발생
 */
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await client.get<HealthResponse>('/health');
  return response.data;
};