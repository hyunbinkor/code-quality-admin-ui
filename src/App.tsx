/**
 * App.tsx
 * 루트 컴포넌트. BrowserRouter + Layout + Route 설정을 담당합니다.
 * 앱 시작 시 dataStore.hydrate()를 호출하여 IndexedDB 데이터를 복원합니다.
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppSider from '@/components/common/AppSider';
import AppHeader from '@/components/common/AppHeader';
import DashboardPage from '@/pages/DashboardPage';
import RulesPage from '@/pages/RulesPage';
import RuleEditPage from '@/pages/RuleEditPage';
import TagsPage from '@/pages/TagsPage';
import SyncPage from '@/pages/SyncPage';
import { useDataStore } from '@/stores/dataStore';

const { Content } = Layout;

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const hydrate = useDataStore((s) => s.hydrate);

  // 앱 시작 시 IndexedDB에서 데이터 복원
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        <AppSider collapsed={collapsed} onCollapse={setCollapsed} />

        <Layout
          style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}
        >
          <AppHeader collapsed={collapsed} onCollapse={setCollapsed} />

          <Content style={{ margin: '24px 24px 0' }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/rules/new" element={<RuleEditPage />} />
              <Route path="/rules/:id" element={<RuleEditPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/sync" element={<SyncPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}
