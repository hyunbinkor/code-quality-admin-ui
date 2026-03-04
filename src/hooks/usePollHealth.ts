/**
 * src/hooks/usePollHealth.ts
 *
 * /health 엔드포인트를 30초 간격으로 폴링하는 커스텀 훅.
 * 마운트 시 즉시 1회 호출 후 인터벌 시작, 언마운트 시 정리.
 */
import { useEffect, useRef } from 'react';
import { checkHealth } from '@/api/healthApi';
import { useUiStore } from '@/stores/uiStore';

const POLL_INTERVAL_MS = 30_000;

export default function usePollHealth() {
  const setServerChecked      = useUiStore((s) => s.setServerChecked);
  const setServerDisconnected = useUiStore((s) => s.setServerDisconnected);
  const setServerStatus       = useUiStore((s) => s.setServerStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await checkHealth();
        setServerChecked(res.version);
      } catch {
        setServerDisconnected();
      }
    };

    setServerStatus('checking');
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setServerChecked, setServerDisconnected, setServerStatus]);
}