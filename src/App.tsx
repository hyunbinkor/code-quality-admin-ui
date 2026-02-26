/**
 * App.tsx
 * 루트 컴포넌트. BrowserRouter + Layout + Route 설정을 담당합니다.
 * 사이드바 레이아웃은 AppSider 컴포넌트에 위임합니다.
 */
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppSider from '@/components/common/AppSider';
import AppHeader from '@/components/common/AppHeader';
import DashboardPage from '@/pages/DashboardPage';
import RulesPage from '@/pages/RulesPage';
import RuleEditPage from '@/pages/RuleEditPage';
import TagsPage from '@/pages/TagsPage';
import SyncPage from '@/pages/SyncPage';

const { Content } = Layout;

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <Layout style={{ minHeight: '100vh' }}>
        {/* 고정 사이드바 */}
        <AppSider collapsed={collapsed} onCollapse={setCollapsed} />

        {/* 사이드바 너비에 맞게 밀린 메인 레이아웃 */}
        <Layout
          className={`app-layout-with-sider${collapsed ? ' collapsed' : ''}`}
          style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}
        >
          <AppHeader collapsed={collapsed} onCollapse={setCollapsed} />

          <Content style={{ margin: '24px 24px 0' }}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/rules/:id" element={<RuleEditPage />} />
              <Route path="/rules/new" element={<RuleEditPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/sync" element={<SyncPage />} />
              {/* 미정의 경로 → 대시보드로 리다이렉트 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </BrowserRouter>
  );
}
