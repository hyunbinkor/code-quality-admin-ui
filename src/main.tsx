/**
 * src/main.tsx
 *
 * 애플리케이션 진입점.
 * React 18 createRoot API 사용.
 *
 * Step 14 변경사항:
 *   - App (AntD) 래퍼 추가
 *       antd 5의 message / Modal.confirm / notification 정적 API가
 *       올바른 테마/locale 컨텍스트 안에서 동작하도록 App으로 감쌉니다.
 *   - ErrorBoundary 최상단 추가
 *       예상치 못한 런타임 에러가 전체 화면을 깨뜨리지 않도록 보호합니다.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntApp, ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={koKR}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      {/*
       * AntApp: antd 5에서 message / Modal / notification 정적 메서드가
       * ConfigProvider 테마를 따르도록 반드시 감싸야 합니다.
       * axios 인터셉터(client.ts)에서 사용하는 message.error()도 이 컨텍스트를 씁니다.
       */}
      <AntApp>
        {/* 최상단 에러 바운더리: 복구 불가 에러 시 폴백 UI 표시 */}
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);