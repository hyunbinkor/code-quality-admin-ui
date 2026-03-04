/**
 * src/utils/tagRefUpdate.ts
 *
 * 규칙의 태그 참조(tagCondition, requiredTags, excludeTags)를 
 * 일괄 업데이트하는 유틸리티 함수 모음.
 * TagSplit / TagMerge 컴포넌트에서 공통으로 사용합니다.
 */
import type { Rule } from '@/types/rule';

/**
 * tagCondition 문자열에서 특정 태그 이름을 교체합니다.
 * 단어 경계(\b)를 사용해 부분 매칭을 방지합니다.
 *
 * @example
 * replaceInCondition('IS_SERVICE || IS_CONTROLLER', 'IS_SERVICE', 'IS_BIZ_SERVICE')
 * // → 'IS_BIZ_SERVICE || IS_CONTROLLER'
 */
export function replaceInCondition(
  condition: string,
  oldTag: string,
  newTag: string,
): string {
  // 정규식 특수문자 이스케이프
  const escaped = oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return condition.replace(new RegExp(`\\b${escaped}\\b`, 'g'), newTag);
}

/**
 * tagCondition에서 특정 태그를 제거합니다.
 * 불리언 연산자(&&, ||)도 함께 정리합니다.
 */
export function removeFromCondition(condition: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let result = condition;
  // "TAG &&", "TAG ||", "&& TAG", "|| TAG" 패턴 제거
  result = result.replace(new RegExp(`\\b${escaped}\\b\\s*(&&|\\|\\|)\\s*`, 'g'), '');
  result = result.replace(new RegExp(`(&&|\\|\\|)\\s*\\b${escaped}\\b`, 'g'), '');
  result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), '');
  // 빈 괄호 정리
  result = result.replace(/\(\s*\)/g, '');
  return result.trim();
}

/**
 * 규칙 배열에서 특정 태그를 참조하는 규칙 목록을 반환합니다.
 */
export function findRulesUsingTag(rules: Rule[], tagName: string): Rule[] {
  return rules.filter((rule) => {
    const inCondition  = rule.tagCondition?.includes(tagName) ?? false;
    const inRequired   = rule.requiredTags?.includes(tagName) ?? false;
    const inExclude    = rule.excludeTags?.includes(tagName) ?? false;
    return inCondition || inRequired || inExclude;
  });
}

/**
 * 규칙 배열에서 여러 태그 중 하나라도 참조하는 규칙 목록을 반환합니다.
 */
export function findRulesUsingAnyTag(rules: Rule[], tagNames: string[]): Rule[] {
  const tagSet = new Set(tagNames);
  return rules.filter((rule) => {
    const inCondition = tagNames.some((t) => rule.tagCondition?.includes(t));
    const inRequired  = rule.requiredTags?.some((t) => tagSet.has(t)) ?? false;
    const inExclude   = rule.excludeTags?.some((t) => tagSet.has(t)) ?? false;
    return inCondition || inRequired || inExclude;
  });
}

/**
 * 규칙의 태그 참조에서 oldTag를 newTag로 교체한 복사본을 반환합니다.
 */
export function replaceTagInRule(rule: Rule, oldTag: string, newTag: string): Rule {
  return {
    ...rule,
    tagCondition: replaceInCondition(rule.tagCondition ?? '', oldTag, newTag),
    requiredTags: (rule.requiredTags ?? []).map((t) => (t === oldTag ? newTag : t)),
    excludeTags:  (rule.excludeTags  ?? []).map((t) => (t === oldTag ? newTag : t)),
  };
}

/**
 * 규칙의 태그 참조에서 oldTag를 제거한 복사본을 반환합니다.
 * Split 시 원본 태그 참조를 삭제할 때 사용합니다.
 */
export function removeTagFromRule(rule: Rule, oldTag: string): Rule {
  return {
    ...rule,
    tagCondition: removeFromCondition(rule.tagCondition ?? '', oldTag),
    requiredTags: (rule.requiredTags ?? []).filter((t) => t !== oldTag),
    excludeTags:  (rule.excludeTags  ?? []).filter((t) => t !== oldTag),
  };
}

/**
 * 규칙의 태그 참조에서 여러 oldTags를 모두 newTag 하나로 교체한 복사본을 반환합니다.
 * Merge 시 사용합니다.
 */
export function mergeTagsInRule(rule: Rule, oldTags: string[], newTag: string): Rule {
  let result = { ...rule };
  // 첫 번째 oldTag를 newTag로 교체
  let replaced = false;
  for (const old of oldTags) {
    if (!replaced) {
      const before = {
        tagCondition: result.tagCondition,
        requiredTags: result.requiredTags,
        excludeTags:  result.excludeTags,
      };
      result = replaceTagInRule(result, old, newTag);
      const changed =
        result.tagCondition !== before.tagCondition ||
        JSON.stringify(result.requiredTags) !== JSON.stringify(before.requiredTags) ||
        JSON.stringify(result.excludeTags)  !== JSON.stringify(before.excludeTags);
      if (changed) replaced = true;
    } else {
      // 나머지 oldTags는 제거 (중복 newTag 방지)
      result = removeTagFromRule(result, old);
    }
  }
  return result;
}