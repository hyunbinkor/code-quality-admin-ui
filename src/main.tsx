/**
 * src/main.tsx
 *
 * 애플리케이션 진입점.
 * React 18 createRoot API 사용.
 *
 * 변경사항:
 *   - monacoSetup을 최상단에서 import
 *     → App 렌더 전에 Monaco loader가 CDN 대신 로컬 번들을 사용하도록 설정
 *   - App (AntD) 래퍼 추가
 *   - ErrorBoundary 최상단 추가
 */

// ⚠️ 반드시 다른 import보다 먼저 위치해야 합니다
import './monacoSetup';

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
      <AntApp>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);