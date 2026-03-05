/**
 * src/stores/dataStore.ts
 *
 * 규칙·태그 데이터 + 버전 정보를 관리하는 Zustand 스토어.
 * Pull / 태그·규칙 CRUD / Push 성공 후 버전 갱신 포함.
 *
 * [Fix] useVersionInfo / useDataStatus 셀렉터에 useShallow 래퍼 적용 (Zustand v5).
 *   - v5에서 두 번째 equalityFn 인자가 제거됨.
 *   - 객체를 반환하는 셀렉터는 반드시 useShallow()로 감싸야 무한 리렌더를 막을 수 있음.
 *
 * ─── 버그 수정 ────────────────────────────────────────────────────────────────
 * [Fix] addRule()에 스토어 레벨 중복 ruleId 방어 추가
 *   - 수정 전: 폼 validator에만 의존 → 빠른 더블클릭·JSON 에디터 경유 시
 *              동일 ruleId 규칙이 배열에 2개 이상 삽입 가능
 *              → Push 시 Qdrant에 마지막 값만 남아 Pull 후 엉뚱한 Diff 발생
 *   - 수정 후: set() 호출 전 some()으로 중복 체크 → 중복이면 warn 후 return
 */
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { pullData } from '@/api/dataApi';
import {
  saveAfterPull,
  saveAfterPush,
  saveSnapshot,
  loadSnapshot,
  loadMeta,
} from '@/storage/idbStorage';
import type { Rule } from '@/types/rule';
import type { TagData, TagDefinition, CompoundTag } from '@/types/tag';
import { EMPTY_TAG_DATA } from '@/types/tag';

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

interface DataState {
  rules:       Rule[];
  tags:        TagData;
  baseVersion: number | null;
  lastPullAt:  string | null;
  lastPushAt:  string | null;
  isLoading:   boolean;
  isHydrated:  boolean;
  error:       string | null;
}

interface DataActions {
  pull:    () => Promise<void>;
  hydrate: () => Promise<void>;

  // 규칙 CRUD
  addRule:    (rule: Rule) => void;
  updateRule: (ruleId: string, updates: Partial<Rule>) => void;
  deleteRule: (ruleId: string) => void;

  // 태그 CRUD
  upsertTag: (name: string, tag: TagDefinition) => void;
  deleteTag: (name: string) => void;

  // 복합 태그 CRUD
  upsertCompoundTag: (name: string, tag: CompoundTag) => void;
  deleteCompoundTag: (name: string) => void;

  // 태그 카테고리 CRUD
  upsertTagCategory: (id: string, description: string) => void;
  deleteTagCategory: (id: string) => void;

  // 태그 전체 교체
  setTags: (tags: TagData) => void;

  // Push 성공 후 버전 갱신
  applyPushSuccess: (newVersion: number, pushedAt: string) => Promise<void>;

  clearError:     () => void;
  persistCurrent: () => Promise<void>;
}

type DataStore = DataState & DataActions;

// ─────────────────────────────────────────────────────────────────────────────
// 스토어
// ─────────────────────────────────────────────────────────────────────────────

export const useDataStore = create<DataStore>((set, get) => ({
  rules:       [],
  tags:        EMPTY_TAG_DATA,
  baseVersion: null,
  lastPullAt:  null,
  lastPushAt:  null,
  isLoading:   false,
  isHydrated:  false,
  error:       null,

  // ── Pull ───────────────────────────────────────────────────────────────────
  pull: async () => {
    set({ isLoading: true, error: null });
    try {
      const pullRes     = await pullData();
      const rules       = pullRes.rules.items; // ⚠️ .items
      const tags        = pullRes.tags;
      const baseVersion = pullRes.version;
      const lastPullAt  = pullRes.pulledAt;

      set({ rules, tags, baseVersion, lastPullAt, isLoading: false, error: null });
      await saveAfterPull({ rules, tags, baseVersion, savedAt: lastPullAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pull 실패';
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // ── Hydrate ────────────────────────────────────────────────────────────────
  hydrate: async () => {
    try {
      const [snapshot, lastPullAt, lastPushAt, baseVersion] = await Promise.all([
        loadSnapshot('snapshot:current'),
        loadMeta('meta:lastPullAt'),
        loadMeta('meta:lastPushAt'),
        loadMeta('meta:baseVersion'),
      ]);

      if (snapshot) {
        set({
          rules:       snapshot.rules,
          tags:        snapshot.tags,
          baseVersion: snapshot.baseVersion ?? baseVersion,
          lastPullAt:  lastPullAt ?? snapshot.savedAt,
          lastPushAt,
          isHydrated:  true,
        });
      } else {
        set({ baseVersion, lastPullAt, lastPushAt, isHydrated: true });
      }
    } catch (error) {
      console.error('[dataStore] hydrate 실패:', error);
      set({ isHydrated: true });
    }
  },

  // ── 규칙 CRUD ──────────────────────────────────────────────────────────────

  /**
   * 규칙 추가
   *
   * [Fix] 스토어 레벨 중복 ruleId 방어
   *   - 폼 validator는 렌더 시점에만 체크 → 빠른 더블클릭이나 JSON 에디터 경유 시
   *     동일 ruleId 규칙이 배열에 두 개 삽입될 수 있음
   *   - 중복 시 warn 로그를 남기고 무시 (데이터 정합성 보호)
   */
  addRule: (rule) => {
    const duplicate = get().rules.some((r) => r.ruleId === rule.ruleId);
    if (duplicate) {
      console.warn(`[dataStore] addRule: 중복 ruleId 무시 → "${rule.ruleId}"`);
      return;
    }
    set((s) => ({ rules: [...s.rules, rule] }));
    get().persistCurrent().catch(console.error);
  },

  updateRule: (ruleId, updates) => {
    set((s) => ({
      rules: s.rules.map((r) => (r.ruleId === ruleId ? { ...r, ...updates } : r)),
    }));
    get().persistCurrent().catch(console.error);
  },

  deleteRule: (ruleId) => {
    set((s) => ({ rules: s.rules.filter((r) => r.ruleId !== ruleId) }));
    get().persistCurrent().catch(console.error);
  },

  // ── 태그 CRUD ──────────────────────────────────────────────────────────────
  upsertTag: (name, tag) => {
    set((s) => ({
      tags: {
        ...s.tags,
        tags: { ...s.tags.tags, [name]: tag },
        _metadata: {
          ...s.tags._metadata,
          totalTags:   Object.keys({ ...s.tags.tags, [name]: tag }).length,
          lastUpdated: new Date().toISOString(),
        },
      },
    }));
    get().persistCurrent().catch(console.error);
  },

  deleteTag: (name) => {
    set((s) => {
      const next = { ...s.tags.tags };
      delete next[name];
      return {
        tags: {
          ...s.tags,
          tags: next,
          _metadata: {
            ...s.tags._metadata,
            totalTags:   Object.keys(next).length,
            lastUpdated: new Date().toISOString(),
          },
        },
      };
    });
    get().persistCurrent().catch(console.error);
  },

  // ── 복합 태그 CRUD ─────────────────────────────────────────────────────────
  upsertCompoundTag: (name, tag) => {
    set((s) => ({
      tags: {
        ...s.tags,
        compoundTags: { ...s.tags.compoundTags, [name]: { ...tag, name } },
      },
    }));
    get().persistCurrent().catch(console.error);
  },

  deleteCompoundTag: (name) => {
    set((s) => {
      const next = { ...s.tags.compoundTags };
      delete next[name];
      return { tags: { ...s.tags, compoundTags: next } };
    });
    get().persistCurrent().catch(console.error);
  },

  // ── 태그 카테고리 CRUD ─────────────────────────────────────────────────────
  upsertTagCategory: (id, description) => {
    set((s) => ({
      tags: {
        ...s.tags,
        tagCategories: { ...s.tags.tagCategories, [id]: description },
      },
    }));
    get().persistCurrent().catch(console.error);
  },

  deleteTagCategory: (id) => {
    set((s) => {
      const next = { ...s.tags.tagCategories };
      delete next[id];
      return { tags: { ...s.tags, tagCategories: next } };
    });
    get().persistCurrent().catch(console.error);
  },

  setTags: (tags) => {
    set({ tags });
    get().persistCurrent().catch(console.error);
  },

  // ── Push 성공 후 버전 갱신 ────────────────────────────────────────────────
  applyPushSuccess: async (newVersion, pushedAt) => {
    const { rules, tags } = get();
    set({ baseVersion: newVersion, lastPushAt: pushedAt });
    try {
      await saveAfterPush(
        { rules, tags, baseVersion: newVersion, savedAt: pushedAt },
        pushedAt,
        newVersion,
      );
    } catch (error) {
      console.error('[dataStore] applyPushSuccess IndexedDB 저장 실패:', error);
    }
  },

  clearError: () => set({ error: null }),

  // ── persistCurrent ─────────────────────────────────────────────────────────
  persistCurrent: async () => {
    const { rules, tags, baseVersion } = get();
    if (baseVersion === null) return;
    try {
      await saveSnapshot('snapshot:current', {
        rules, tags, baseVersion,
        savedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[dataStore] persistCurrent 실패:', error);
    }
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// 셀렉터
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 원시값(배열 참조)을 그대로 반환하므로 useShallow 불필요.
 * Zustand는 rules 배열 자체의 참조가 바뀔 때만 리렌더를 트리거합니다.
 */
export const useRules = () => useDataStore((s) => s.rules);
export const useTags  = () => useDataStore((s) => s.tags);

/**
 * ⚠️ Zustand v5: 객체를 반환하는 셀렉터는 반드시 useShallow()로 감싸야 합니다.
 *   그렇지 않으면 매 렌더마다 새 객체({} !== {})가 반환되어 무한 리렌더 루프가 발생합니다.
 */
export const useVersionInfo = () =>
  useDataStore(
    useShallow((s) => ({
      baseVersion: s.baseVersion,
      lastPullAt:  s.lastPullAt,
      lastPushAt:  s.lastPushAt,
    })),
  );

export const useDataStatus = () =>
  useDataStore(
    useShallow((s) => ({
      isLoading:  s.isLoading,
      isHydrated: s.isHydrated,
      error:      s.error,
    })),
  );