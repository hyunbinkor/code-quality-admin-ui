/**
 * src/App.tsx
 *
 * 루트 컴포넌트. BrowserRouter + Layout + Route 설정을 담당합니다.
 *
 * Step 13 변경사항 (오프라인 지원):
 *   - usePollHealth를 DashboardPage → App 수준으로 승격
 *     (어떤 페이지에 있어도 30초 폴링이 끊기지 않도록)
 *   - useAutoSave: rules/tags 변경 시 1초 debounce로 IndexedDB 자동 저장
 *   - useOnlineSync: disconnected → connected 전환 감지 → 동기화 안내 모달
 *   - OfflineBanner: 서버 연결 끊김 시 상단 경고 배너 표시
 *
 * 구조:
 *   <BrowserRouter>
 *     <AppInner>          ← useNavigate 등 라우터 훅이 필요한 훅/컴포넌트
 *       <Layout>
 *         <OfflineBanner> ← 오프라인 시 배너
 *         <Content>
 *           <Routes>
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppSider      from '@/components/common/AppSider';
import AppHeader     from '@/components/common/AppHeader';
import OfflineBanner from '@/components/common/OfflineBanner';
import DashboardPage from '@/pages/DashboardPage';
import RulesPage     from '@/pages/RulesPage';
import RuleEditPage  from '@/pages/RuleEditPage';
import TagsPage      from '@/pages/TagsPage';
import SyncPage      from '@/pages/SyncPage';
import { useDataStore }  from '@/stores/dataStore';
import usePollHealth     from '@/hooks/usePollHealth';
import useAutoSave       from '@/hooks/useAutoSave';
import useOnlineSync     from '@/hooks/useOnlineSync';

const { Content } = Layout;

// ─────────────────────────────────────────────────────────────────────────────
// AppInner — BrowserRouter 내부에서만 사용 가능한 훅을 모아둔 내부 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

function AppInner() {
  const [collapsed, setCollapsed] = useState(false);
  const hydrate = useDataStore((s) => s.hydrate);

  // ── 앱 시작 시 IndexedDB에서 데이터 복원 ────────────────────────────────
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ── 서버 상태 폴링 (30초 간격, 앱 전체 수명 동안 유지) ──────────────────
  usePollHealth();

  // ── 편집 내용 자동 저장 (1초 debounce) ──────────────────────────────────
  useAutoSave();

  // ── 온라인 복귀 감지 → 동기화 안내 모달 ─────────────────────────────────
  useOnlineSync();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppSider collapsed={collapsed} onCollapse={setCollapsed} />

      <Layout
        style={{
          marginLeft: collapsed ? 80 : 200,
          transition: 'margin-left 0.2s',
        }}
      >
        <AppHeader collapsed={collapsed} onCollapse={setCollapsed} />

        {/* 오프라인 배너: 서버 연결 끊김 시 Content 위에 표시 */}
        <OfflineBanner />

        <Content style={{ margin: '24px 24px 0' }}>
          <Routes>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/rules"     element={<RulesPage />} />
            <Route path="/rules/new" element={<RuleEditPage />} />
            <Route path="/rules/:id" element={<RuleEditPage />} />
            <Route path="/tags"      element={<TagsPage />} />
            <Route path="/sync"      element={<SyncPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App — BrowserRouter로 감싸는 최상위 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}