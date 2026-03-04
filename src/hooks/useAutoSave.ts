/**
 * src/hooks/useAutoSave.ts
 *
 * 규칙·태그 상태가 변경될 때마다 IndexedDB 'snapshot:current'에
 * 1초 debounce로 자동 저장하는 커스텀 훅.
 *
 * 동작 순서:
 *   1. isHydrated가 false이거나 baseVersion이 null이면 저장 스킵
 *      (hydrate 완료 전에는 빈 데이터를 덮어쓰지 않도록)
 *   2. hydrate 직후 첫 번째 effect 실행은 스킵
 *      (복원된 데이터를 불필요하게 다시 저장하지 않도록)
 *   3. 이후 rules·tags가 변경될 때마다 1초 뒤에 persistCurrent() 호출
 *
 * 참고:
 *   각 CRUD 액션(addRule, updateRule 등)에서도 persistCurrent()를 직접 호출하므로
 *   이 훅은 '보험용' catch-all 역할을 합니다. 1초 debounce라 연속 편집 시
 *   불필요한 IDB 쓰기를 줄여줍니다.
 */
import { useEffect, useRef } from 'react';
import { useDataStore } from '@/stores/dataStore';

const DEBOUNCE_MS = 1_000;

export default function useAutoSave(): void {
  const rules          = useDataStore((s) => s.rules);
  const tags           = useDataStore((s) => s.tags);
  const baseVersion    = useDataStore((s) => s.baseVersion);
  const isHydrated     = useDataStore((s) => s.isHydrated);
  const persistCurrent = useDataStore((s) => s.persistCurrent);

  /** 디바운스 타이머 ref */
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * hydrate 완료 직후 최초 1회 실행을 건너뛰기 위한 플래그.
   * - 초기값 true: 아직 hydrate를 기다리는 중
   * - false: hydrate 완료 후 사용자 편집부터 저장
   */
  const isFirstRef  = useRef<boolean>(true);

  useEffect(() => {
    // hydrate 미완료 또는 baseVersion 없으면 저장 안 함
    if (!isHydrated || baseVersion === null) return;

    // hydrate 직후 최초 실행 건너뜀
    if (isFirstRef.current) {
      isFirstRef.current = false;
      return;
    }

    // 기존 타이머 취소 후 1초 뒤 저장
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persistCurrent().catch((err) => {
        console.error('[useAutoSave] persistCurrent 실패:', err);
      });
    }, DEBOUNCE_MS);

    // cleanup: 언마운트 또는 다음 effect 실행 전 타이머 취소
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rules, tags, baseVersion, isHydrated, persistCurrent]);
}