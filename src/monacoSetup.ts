/**
 * src/monacoSetup.ts
 *
 * Monaco Editor 로컬 번들 설정.
 *
 * 문제: @monaco-editor/react는 기본적으로 jsDelivr CDN에서 monaco를 로드합니다.
 *       금융권 환경에서는 외부 CDN이 차단되어 에디터가 무한 Loading 상태에 빠집니다.
 *
 * 해결: loader.config({ monaco })로 로컬 npm 번들을 직접 지정합니다.
 *       Vite ?worker 문법으로 Web Worker도 로컬에서 초기화합니다.
 *
 * 반드시 main.tsx 최상단에서 import 해야 합니다 (App 렌더 전).
 */
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker   from 'monaco-editor/esm/vs/language/json/json.worker?worker';

// Vite 환경에서 Monaco Web Worker 수동 초기화
// (CDN 로딩 없이 로컬 번들만 사용)
(self as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker();
    return new editorWorker();
  },
};

// CDN 대신 로컬 번들된 monaco 인스턴스를 loader에 직접 주입
loader.config({ monaco });