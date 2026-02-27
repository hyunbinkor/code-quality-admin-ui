/**
 * src/storage/idbStorage.ts
 *
 * IndexedDB 저장소 추상화 레이어.
 * idb 라이브러리를 사용하여 스냅샷(규칙+태그)과 메타데이터를 저장합니다.
 *
 * localStorage 대신 IndexedDB를 사용하는 이유:
 *   - Pull 응답(규칙 수백 개 + 태그 전체)은 수백KB~수MB에 달할 수 있음
 *   - localStorage 용량 한계 ~5MB → IndexedDB로 고정
 *
 * DB 구조:
 *   DB명: 'code-quality-admin'
 *   버전: 1
 *   스토어:
 *     - 'snapshots' : 스냅샷 데이터 (origin / current / lastPush)
 *     - 'meta'      : 메타데이터 (lastPullAt / lastPushAt / baseVersion)
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { LocalSnapshot } from '@/types/api';

// ─────────────────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

/** 스냅샷 슬롯 키 */
export type SnapshotSlot =
  | 'snapshot:origin'    // Pull 시 받은 서버 원본 (읽기 전용 기준점)
  | 'snapshot:current'   // 현재 로컬 편집 중인 데이터
  | 'snapshot:lastPush'; // 마지막 Push 성공 시점 데이터

/** 메타 슬롯 키 */
export type MetaSlot =
  | 'meta:lastPullAt'   // 마지막 Pull 시각 (ISO datetime string)
  | 'meta:lastPushAt'   // 마지막 Push 시각 (ISO datetime string)
  | 'meta:baseVersion'; // 현재 baseVersion (number)

/** 메타 슬롯별 값 타입 매핑 */
interface MetaValueMap {
  'meta:lastPullAt': string;
  'meta:lastPushAt': string;
  'meta:baseVersion': number;
}

/** DB 스키마 정의 (idb 타입 파라미터용) */
interface CodeQualityDB {
  snapshots: {
    key: SnapshotSlot;
    value: LocalSnapshot;
  };
  meta: {
    key: MetaSlot;
    value: string | number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DB 초기화
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = 'code-quality-admin';
const DB_VERSION = 1;

/** DB 인스턴스 (싱글톤) */
let dbInstance: IDBPDatabase<CodeQualityDB> | null = null;

/**
 * IndexedDB 연결을 열고 싱글톤 인스턴스를 반환합니다.
 * 이미 열려 있으면 기존 인스턴스를 재사용합니다.
 */
const getDB = async (): Promise<IDBPDatabase<CodeQualityDB>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<CodeQualityDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 스냅샷 스토어 (origin / current / lastPush)
      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots');
      }
      // 메타 스토어 (lastPullAt / lastPushAt / baseVersion)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta');
      }
    },
    blocked() {
      console.warn('[idbStorage] DB 업그레이드가 다른 탭에 의해 차단되었습니다.');
    },
    blocking() {
      // 다른 탭이 더 새로운 버전을 열려고 할 때 현재 연결을 닫아줌
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      console.error('[idbStorage] DB 연결이 예기치 않게 종료되었습니다.');
      dbInstance = null;
    },
  });

  return dbInstance;
};

// ─────────────────────────────────────────────────────────────────────────────
// 스냅샷 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 스냅샷을 IndexedDB에 저장합니다.
 *
 * @param slot    - 저장할 슬롯 ('snapshot:origin' | 'snapshot:current' | 'snapshot:lastPush')
 * @param snapshot - 저장할 스냅샷 데이터 (rules + tags + baseVersion + savedAt)
 *
 * @example
 * // Pull 완료 후 origin과 current 모두 저장
 * await saveSnapshot('snapshot:origin', { rules, tags, baseVersion, savedAt: new Date().toISOString() });
 * await saveSnapshot('snapshot:current', { rules, tags, baseVersion, savedAt: new Date().toISOString() });
 */
export const saveSnapshot = async (
  slot: SnapshotSlot,
  snapshot: LocalSnapshot,
): Promise<void> => {
  try {
    const db = await getDB();
    await db.put('snapshots', snapshot, slot);
  } catch (error) {
    console.error(`[idbStorage] saveSnapshot(${slot}) 실패:`, error);
    throw error;
  }
};

/**
 * IndexedDB에서 스냅샷을 불러옵니다.
 *
 * @param slot - 불러올 슬롯
 * @returns LocalSnapshot 또는 해당 슬롯이 비어있으면 null
 *
 * @example
 * const current = await loadSnapshot('snapshot:current');
 * if (current) {
 *   store.setRules(current.rules);
 *   store.setTags(current.tags);
 * }
 */
export const loadSnapshot = async (
  slot: SnapshotSlot,
): Promise<LocalSnapshot | null> => {
  try {
    const db = await getDB();
    const value = await db.get('snapshots', slot);
    return value ?? null;
  } catch (error) {
    console.error(`[idbStorage] loadSnapshot(${slot}) 실패:`, error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 메타 API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 메타데이터를 IndexedDB에 저장합니다.
 *
 * @param slot  - 저장할 메타 슬롯
 * @param value - 저장할 값 (슬롯 타입에 따라 string 또는 number)
 *
 * @example
 * await saveMeta('meta:lastPullAt', new Date().toISOString());
 * await saveMeta('meta:baseVersion', pullResponse.version);
 */
export const saveMeta = async <K extends MetaSlot>(
  slot: K,
  value: MetaValueMap[K],
): Promise<void> => {
  try {
    const db = await getDB();
    await db.put('meta', value, slot);
  } catch (error) {
    console.error(`[idbStorage] saveMeta(${slot}) 실패:`, error);
    throw error;
  }
};

/**
 * IndexedDB에서 메타데이터를 불러옵니다.
 *
 * @param slot - 불러올 메타 슬롯
 * @returns 저장된 값 또는 해당 슬롯이 비어있으면 null
 *
 * @example
 * const lastPullAt = await loadMeta('meta:lastPullAt');  // string | null
 * const baseVersion = await loadMeta('meta:baseVersion'); // number | null
 */
export const loadMeta = async <K extends MetaSlot>(
  slot: K,
): Promise<MetaValueMap[K] | null> => {
  try {
    const db = await getDB();
    const value = await db.get('meta', slot);
    return (value as MetaValueMap[K]) ?? null;
  } catch (error) {
    console.error(`[idbStorage] loadMeta(${slot}) 실패:`, error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 모든 스냅샷과 메타데이터를 삭제합니다.
 * 초기화 또는 완전 리셋 시 사용합니다.
 *
 * @example
 * await clearAll(); // DB 전체 초기화
 */
export const clearAll = async (): Promise<void> => {
  try {
    const db = await getDB();
    const tx = db.transaction(['snapshots', 'meta'], 'readwrite');
    await Promise.all([
      tx.objectStore('snapshots').clear(),
      tx.objectStore('meta').clear(),
      tx.done,
    ]);
  } catch (error) {
    console.error('[idbStorage] clearAll() 실패:', error);
    throw error;
  }
};

/**
 * Pull 완료 시 3개의 슬롯과 2개의 메타를 한 번에 저장하는 편의 함수.
 * origin과 current를 동일한 데이터로 초기화합니다.
 *
 * @param snapshot - Pull 응답으로 만든 스냅샷 (rules.items, tags, version)
 *
 * @example
 * const pullRes = await pullData();
 * await saveAfterPull({
 *   rules: pullRes.rules.items,  // ⚠️ .items 로 접근
 *   tags: pullRes.tags,
 *   baseVersion: pullRes.version,
 *   savedAt: new Date().toISOString(),
 * });
 */
export const saveAfterPull = async (snapshot: LocalSnapshot): Promise<void> => {
  await Promise.all([
    saveSnapshot('snapshot:origin', snapshot),
    saveSnapshot('snapshot:current', snapshot),
    saveMeta('meta:lastPullAt', snapshot.savedAt),
    saveMeta('meta:baseVersion', snapshot.baseVersion),
  ]);
};

/**
 * Push 성공 시 lastPush 슬롯과 메타를 한 번에 저장하는 편의 함수.
 *
 * @param snapshot   - 현재 로컬 스냅샷 (Push한 데이터)
 * @param pushedAt   - Push 완료 시각 (서버 응답의 pushedAt)
 * @param newVersion - Push 후 새 버전 (서버 응답의 newVersion)
 *
 * @example
 * const pushRes = await pushData({ ... });
 * if (isPushSuccess(pushRes)) {
 *   await saveAfterPush(currentSnapshot, pushRes.pushedAt, pushRes.newVersion);
 * }
 */
export const saveAfterPush = async (
  snapshot: LocalSnapshot,
  pushedAt: string,
  newVersion: number,
): Promise<void> => {
  const updatedSnapshot: LocalSnapshot = {
    ...snapshot,
    baseVersion: newVersion,
    savedAt: pushedAt,
  };

  await Promise.all([
    saveSnapshot('snapshot:lastPush', updatedSnapshot),
    saveSnapshot('snapshot:current', updatedSnapshot),
    saveMeta('meta:lastPushAt', pushedAt),
    saveMeta('meta:baseVersion', newVersion),
  ]);
};