/**
 * src/stores/dataStore.ts
 *
 * 규칙·태그 데이터 및 버전 관리 Zustand 스토어.
 *
 * 책임:
 *   - 규칙(rules[]), 태그(tags), baseVersion 상태 관리
 *   - pull(): 서버 → 스토어 + IndexedDB 저장
 *   - hydrate(): 앱 시작 시 IndexedDB → 스토어 복원
 *   - 규칙 CRUD (로컬 편집 → Push로 서버 반영)
 *
 * ⚠️ Pull 응답에서 rules는 { count, items } 래퍼 구조입니다.
 *    반드시 pullRes.rules.items 로 접근하세요.
 */
import { create } from 'zustand';
import { pullData } from '@/api/dataApi';
import {
  saveAfterPull,
  saveSnapshot,
  loadSnapshot,
  loadMeta,
} from '@/storage/idbStorage';
import type { Rule } from '@/types/rule';
import type { TagData } from '@/types/tag';
import { EMPTY_TAG_DATA } from '@/types/tag';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

interface DataState {
  // ── 데이터 ─────────────────────────────────────────────────────────────────
  rules: Rule[];
  tags: TagData;

  // ── 버전 / 타임스탬프 ───────────────────────────────────────────────────────
  /**
   * Pull 시 받은 version 값.
   * Diff / Push 요청 시 baseVersion 필드로 전달합니다.
   */
  baseVersion: number | null;
  lastPullAt: string | null;   // ISO datetime
  lastPushAt: string | null;   // ISO datetime

  // ── 로딩 ───────────────────────────────────────────────────────────────────
  isLoading: boolean;
  /** hydrate 완료 여부 — 앱 초기 렌더 전 IndexedDB 복원 완료를 나타냄 */
  isHydrated: boolean;

  // ── 에러 ───────────────────────────────────────────────────────────────────
  error: string | null;
}

interface DataActions {
  /**
   * 서버에서 전체 데이터를 Pull합니다.
   * 1. GET /api/data/pull 호출
   * 2. 스토어 상태 업데이트 (rules, tags, baseVersion, lastPullAt)
   * 3. IndexedDB origin + current 슬롯 저장
   */
  pull: () => Promise<void>;

  /**
   * 앱 시작 시 IndexedDB에서 데이터를 복원합니다.
   * snapshot:current → rules, tags
   * meta:baseVersion  → baseVersion
   * meta:lastPullAt   → lastPullAt
   * meta:lastPushAt   → lastPushAt
   */
  hydrate: () => Promise<void>;

  // ── 규칙 CRUD (로컬 편집 — Push로 서버 반영) ───────────────────────────────

  /** 규칙 추가 */
  addRule: (rule: Rule) => void;

  /** 규칙 수정 (ruleId 기준) */
  updateRule: (ruleId: string, updates: Partial<Rule>) => void;

  /** 규칙 삭제 (ruleId 기준) */
  deleteRule: (ruleId: string) => void;

  /** 태그 전체 교체 (태그 편집 완료 후 호출) */
  setTags: (tags: TagData) => void;

  /** 에러 초기화 */
  clearError: () => void;

  /**
   * 현재 스토어 상태를 IndexedDB snapshot:current에 저장합니다.
   * 규칙/태그 편집 후 명시적으로 호출하거나,
   * addRule / updateRule / deleteRule에서 자동 호출됩니다.
   */
  persistCurrent: () => Promise<void>;
}

type DataStore = DataState & DataActions;

// ─────────────────────────────────────────────────────────────────────────────
// 초기 상태
// ─────────────────────────────────────────────────────────────────────────────

const initialState: DataState = {
  rules: [],
  tags: EMPTY_TAG_DATA,
  baseVersion: null,
  lastPullAt: null,
  lastPushAt: null,
  isLoading: false,
  isHydrated: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// 스토어 생성
// ─────────────────────────────────────────────────────────────────────────────

export const useDataStore = create<DataStore>((set, get) => ({
  ...initialState,

  // ── Pull ───────────────────────────────────────────────────────────────────
  pull: async () => {
    set({ isLoading: true, error: null });

    try {
      const pullRes = await pullData();

      // ⚠️ rules는 { count, items } 래퍼 — 반드시 .items로 접근
      const rules = pullRes.rules.items;
      const tags = pullRes.tags;
      const baseVersion = pullRes.version;
      const lastPullAt = pullRes.pulledAt;

      // 1. 스토어 업데이트
      set({
        rules,
        tags,
        baseVersion,
        lastPullAt,
        isLoading: false,
        error: null,
      });

      // 2. IndexedDB 저장 (origin + current + meta)
      const snapshot = {
        rules,
        tags,
        baseVersion,
        savedAt: lastPullAt,
      };
      await saveAfterPull(snapshot);

    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Pull 중 알 수 없는 오류가 발생했습니다.';

      set({ isLoading: false, error: message });
      throw error; // 호출자(UI)에서 추가 처리 가능하도록 re-throw
    }
  },

  // ── Hydrate ────────────────────────────────────────────────────────────────
  hydrate: async () => {
    try {
      // IndexedDB에서 병렬 로드
      const [snapshot, lastPullAt, lastPushAt, baseVersion] = await Promise.all([
        loadSnapshot('snapshot:current'),
        loadMeta('meta:lastPullAt'),
        loadMeta('meta:lastPushAt'),
        loadMeta('meta:baseVersion'),
      ]);

      if (snapshot) {
        set({
          rules: snapshot.rules,
          tags: snapshot.tags,
          baseVersion: snapshot.baseVersion ?? baseVersion,
          lastPullAt: lastPullAt ?? snapshot.savedAt,
          lastPushAt,
          isHydrated: true,
        });
      } else {
        // IndexedDB에 데이터 없음 (최초 실행)
        set({
          baseVersion,
          lastPullAt,
          lastPushAt,
          isHydrated: true,
        });
      }
    } catch (error) {
      console.error('[dataStore] hydrate 실패:', error);
      // hydrate 실패해도 앱은 계속 동작
      set({ isHydrated: true });
    }
  },

  // ── 규칙 CRUD ──────────────────────────────────────────────────────────────
  addRule: (rule) => {
    set((state) => ({ rules: [...state.rules, rule] }));
    // 비동기 persist (에러는 내부에서 처리)
    get().persistCurrent().catch(console.error);
  },

  updateRule: (ruleId, updates) => {
    set((state) => ({
      rules: state.rules.map((r) =>
        r.ruleId === ruleId ? { ...r, ...updates } : r,
      ),
    }));
    get().persistCurrent().catch(console.error);
  },

  deleteRule: (ruleId) => {
    set((state) => ({
      rules: state.rules.filter((r) => r.ruleId !== ruleId),
    }));
    get().persistCurrent().catch(console.error);
  },

  setTags: (tags) => {
    set({ tags });
    get().persistCurrent().catch(console.error);
  },

  clearError: () => set({ error: null }),

  // ── persistCurrent ─────────────────────────────────────────────────────────
  persistCurrent: async () => {
    const { rules, tags, baseVersion } = get();

    // baseVersion이 없으면 아직 Pull 전 → 저장 불필요
    if (baseVersion === null) return;

    try {
      await saveSnapshot('snapshot:current', {
        rules,
        tags,
        baseVersion,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[dataStore] persistCurrent 실패:', error);
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 셀렉터 (성능 최적화 — 필요한 필드만 구독)
// ─────────────────────────────────────────────────────────────────────────────

/** 규칙 배열만 구독 */
export const useRules = () => useDataStore((s) => s.rules);

/** 태그 데이터만 구독 */
export const useTags = () => useDataStore((s) => s.tags);

/** 버전/타임스탬프 정보만 구독 */
export const useVersionInfo = () =>
  useDataStore((s) => ({
    baseVersion: s.baseVersion,
    lastPullAt: s.lastPullAt,
    lastPushAt: s.lastPushAt,
  }));

/** 로딩/에러 상태만 구독 */
export const useDataStatus = () =>
  useDataStore((s) => ({
    isLoading: s.isLoading,
    isHydrated: s.isHydrated,
    error: s.error,
  }));