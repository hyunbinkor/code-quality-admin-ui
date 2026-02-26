/**
 * AppSider.tsx
 * 고정 사이드바 컴포넌트.
 * Ant Design Sider + Menu를 사용하여 페이지 네비게이션을 제공합니다.
 */
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  TagsOutlined,
  SyncOutlined,
  CodeOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;
const { Text } = Typography;

interface AppSiderProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '대시보드',
  },
  {
    key: '/rules',
    icon: <FileTextOutlined />,
    label: '규칙 관리',
  },
  {
    key: '/tags',
    icon: <TagsOutlined />,
    label: '태그 관리',
  },
  {
    key: '/sync',
    icon: <SyncOutlined />,
    label: '데이터 동기화',
  },
];

export default function AppSider({ collapsed, onCollapse }: AppSiderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // 현재 경로에서 활성 메뉴 키 계산
  // /rules/:id 같은 하위 경로도 /rules 메뉴를 활성화
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/rules')) return '/rules';
    if (path.startsWith('/tags')) return '/tags';
    if (path.startsWith('/sync')) return '/sync';
    return '/';
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      className="app-sider"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'auto',
        zIndex: 100,
      }}
      width={200}
      collapsedWidth={80}
    >
      {/* 로고 영역 */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <CodeOutlined style={{ fontSize: 22, color: '#1677ff', flexShrink: 0 }} />
        {!collapsed && (
          <Text
            strong
            style={{
              color: '#fff',
              fontSize: 13,
              whiteSpace: 'nowrap',
              lineHeight: '1.3',
            }}
          >
            Code Quality
            <br />
            Admin UI
          </Text>
        )}
      </div>

      {/* 네비게이션 메뉴 */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 0, marginTop: 8 }}
      />
    </Sider>
  );
}
