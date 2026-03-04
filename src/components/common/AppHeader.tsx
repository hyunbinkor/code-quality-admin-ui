/**
 * src/components/common/AppHeader.tsx
 *
 * 상단 헤더 컴포넌트.
 * 사이드바 토글, 브레드크럼, 서버 연결 상태(ServerStatus)를 표시합니다.
 */
import { Layout, Button, Breadcrumb, Space } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useLocation, Link } from 'react-router-dom';
import ServerStatus from '@/components/common/ServerStatus';

const { Header } = Layout;

interface AppHeaderProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  '/':          { label: '대시보드' },
  '/rules':     { label: '규칙 관리' },
  '/rules/new': { label: '새 규칙', parent: '/rules' },
  '/tags':      { label: '태그 관리' },
  '/sync':      { label: '데이터 동기화' },
};

function getBreadcrumbItems(pathname: string) {
  if (/^\/rules\/[^/]+$/.test(pathname) && pathname !== '/rules/new') {
    return [
      { title: <Link to="/rules">규칙 관리</Link> },
      { title: '규칙 편집' },
    ];
  }
  const config = breadcrumbMap[pathname];
  if (!config) return [{ title: '—' }];

  const items = [];
  if (config.parent) {
    const parentConfig = breadcrumbMap[config.parent];
    items.push({ title: <Link to={config.parent}>{parentConfig?.label}</Link> });
  }
  items.push({ title: config.label });
  return items;
}

export default function AppHeader({ collapsed, onCollapse }: AppHeaderProps) {
  const location = useLocation();

  return (
    <Header
      style={{
        background: '#fff',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 99,
        height: 64,
      }}
    >
      <Space size={16}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => onCollapse(!collapsed)}
          style={{ fontSize: 16 }}
        />
        <Breadcrumb items={getBreadcrumbItems(location.pathname)} />
      </Space>

      <ServerStatus />
    </Header>
  );
}