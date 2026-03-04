/**
 * src/stores/uiStore.ts
 *
 * UI 전역 상태 Zustand 스토어.
 *
 * 책임:
 *   - 서버 연결 상태 (serverConnected, lastCheckedAt)
 *   - 토스트 알림 큐 (notifications[])
 *
 * 서버 연결 폴링은 App.tsx(AppInner)에서 usePollHealth()로 30초 간격 실행합니다.
 *
 * [Fix] useServerStatus 셀렉터에 useShallow 래퍼 적용 (Zustand v5).
 *   - v5에서 두 번째 인자로 equalityFn을 넘기는 방식이 제거됨.
 *   - 셀렉터가 객체를 반환할 때 매 호출마다 새 참조가 생성되어
 *     무한 리렌더 루프가 발생하는 문제를 useShallow 래퍼로 해결.
 *   - import 경로: 'zustand/react/shallow'
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  /** 알림 고유 ID (자동 생성) */
  id: string;
  type: NotificationType;
  /** 알림 제목 */
  title: string;
  /** 알림 상세 메시지 (선택) */
  message?: string;
  /** 자동 닫힘 지연 ms (기본: 4000, 0이면 수동 닫기) */
  duration?: number;
}

export type ServerStatus = 'connected' | 'disconnected' | 'checking';

interface UiState {
  // ── 서버 연결 상태 ──────────────────────────────────────────────────────────
  serverStatus: ServerStatus;
  /** 마지막 /health 응답 시각 (ISO datetime) */
  lastCheckedAt: string | null;
  /** 서버 버전 (HealthResponse.version) */
  serverVersion: string | null;

  // ── 알림 큐 ────────────────────────────────────────────────────────────────
  notifications: Notification[];
}

interface UiActions {
  // ── 서버 상태 ──────────────────────────────────────────────────────────────
  setServerStatus: (status: ServerStatus) => void;
  setServerChecked: (version: string) => void;
  setServerDisconnected: () => void;

  // ── 알림 ───────────────────────────────────────────────────────────────────

  /**
   * 알림을 추가합니다.
   * id는 자동 생성됩니다.
   */
  addNotification: (notification: Omit<Notification, 'id'>) => void;

  /** 특정 알림 제거 */
  removeNotification: (id: string) => void;

  /** 모든 알림 제거 */
  clearNotifications: () => void;

  // ── 편의 메서드 (자주 쓰는 알림 패턴) ────────────────────────────────────

  /** 성공 알림 */
  notifySuccess: (title: string, message?: string) => void;

  /** 에러 알림 */
  notifyError: (title: string, message?: string) => void;

  /** 경고 알림 */
  notifyWarning: (title: string, message?: string) => void;

  /** 정보 알림 */
  notifyInfo: (title: string, message?: string) => void;
}

type UiStore = UiState & UiActions;

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

let notificationIdCounter = 0;
const generateId = () => `notif-${++notificationIdCounter}-${Date.now()}`;

// ─────────────────────────────────────────────────────────────────────────────
// 스토어 생성
// ─────────────────────────────────────────────────────────────────────────────

export const useUiStore = create<UiStore>((set, get) => ({
  // ── 초기 상태 ───────────────────────────────────────────────────────────────
  serverStatus: 'checking',
  lastCheckedAt: null,
  serverVersion: null,
  notifications: [],

  // ── 서버 상태 액션 ──────────────────────────────────────────────────────────
  setServerStatus: (status) => set({ serverStatus: status }),

  setServerChecked: (version) =>
    set({
      serverStatus: 'connected',
      lastCheckedAt: new Date().toISOString(),
      serverVersion: version,
    }),

  setServerDisconnected: () =>
    set({
      serverStatus: 'disconnected',
      lastCheckedAt: new Date().toISOString(),
    }),

  // ── 알림 액션 ───────────────────────────────────────────────────────────────
  addNotification: (notification) => {
    const id = generateId();
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));

    // duration이 0이 아니면 자동 제거
    const duration = notification.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  clearNotifications: () => set({ notifications: [] }),

  // ── 편의 메서드 ─────────────────────────────────────────────────────────────
  notifySuccess: (title, message) =>
    get().addNotification({ type: 'success', title, message }),

  notifyError: (title, message) =>
    get().addNotification({ type: 'error', title, message, duration: 6000 }),

  notifyWarning: (title, message) =>
    get().addNotification({ type: 'warning', title, message, duration: 5000 }),

  notifyInfo: (title, message) =>
    get().addNotification({ type: 'info', title, message }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// 셀렉터
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 서버 연결 상태만 구독.
 *
 * ⚠️ Zustand v5: 두 번째 인자로 equalityFn을 넘기는 방식이 제거됨.
 *   객체를 반환하는 셀렉터는 반드시 useShallow()로 감싸야 합니다.
 *   그렇지 않으면 매 렌더마다 새 객체({} !== {})가 반환되어
 *   무한 리렌더 루프가 발생합니다.
 *
 *   import 경로: 'zustand/react/shallow'  ← 반드시 이 경로
 */
export const useServerStatus = () =>
  useUiStore(
    useShallow((s) => ({
      serverStatus:  s.serverStatus,
      lastCheckedAt: s.lastCheckedAt,
      serverVersion: s.serverVersion,
    })),
  );

/** 알림 목록만 구독 (배열 참조는 Zustand가 동일하게 유지하므로 useShallow 불필요) */
export const useNotifications = () =>
  useUiStore((s) => s.notifications);