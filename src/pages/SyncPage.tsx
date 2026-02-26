/**
 * SyncPage.tsx
 * 데이터 동기화 페이지.
 * - Pull: 서버 전체 데이터 다운로드 — Step 5에서 구현
 * - Diff: 변경사항 미리보기 — Step 11에서 구현
 * - Push: 서버 업로드 + 버전 충돌 처리 — Step 12에서 구현
 * - 오프라인 편집 지원 — Step 13에서 구현
 */
import {
  Button,
  Card,
  Col,
  Row,
  Steps,
  Typography,
  Alert,
  Space,
  Statistic,
  Divider,
} from 'antd';
import {
  CloudDownloadOutlined,
  DiffOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

export default function SyncPage() {
  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 24 }}>
        데이터 동기화
      </Title>

      <Alert
        type="info"
        showIcon
        message="Step 5, 11, 12, 13 구현 예정"
        description="Pull/Diff/Push 기능은 각 스텝에서 순차적으로 구현됩니다. 현재는 UI 레이아웃만 확인할 수 있습니다."
        style={{ marginBottom: 24 }}
        closable
      />

      {/* 워크플로우 안내 */}
      <Card title="동기화 워크플로우" style={{ marginBottom: 24 }}>
        <Steps
          items={[
            {
              title: 'Pull',
              description: '서버 데이터 다운로드',
              icon: <CloudDownloadOutlined />,
              status: 'wait',
            },
            {
              title: '로컬 편집',
              description: '규칙/태그 수정',
              icon: <DiffOutlined />,
              status: 'wait',
            },
            {
              title: 'Diff',
              description: '변경사항 확인',
              icon: <DiffOutlined />,
              status: 'wait',
            },
            {
              title: 'Push',
              description: '서버 업로드',
              icon: <CloudUploadOutlined />,
              status: 'wait',
            },
            {
              title: '완료',
              icon: <CheckCircleOutlined />,
              status: 'wait',
            },
          ]}
        />
      </Card>

      {/* 액션 버튼 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <CloudDownloadOutlined style={{ color: '#1677ff' }} />
                Pull
              </Space>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              서버에서 최신 규칙과 태그 데이터를 다운로드합니다.
              기존 로컬 데이터는 IndexedDB에 백업됩니다.
            </Text>
            <Statistic title="마지막 Pull" value="—" style={{ marginBottom: 16 }} />
            <Button type="primary" icon={<CloudDownloadOutlined />} block disabled>
              Pull 실행 (Step 5)
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <DiffOutlined style={{ color: '#722ed1' }} />
                Diff
              </Space>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              로컬 수정 내용과 서버 데이터를 비교합니다.
              추가/수정/삭제 항목을 미리 확인할 수 있습니다.
            </Text>
            <Statistic title="변경사항" value="—" style={{ marginBottom: 16 }} />
            <Button icon={<DiffOutlined />} block disabled>
              Diff 확인 (Step 11)
            </Button>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card
            title={
              <Space>
                <CloudUploadOutlined style={{ color: '#52c41a' }} />
                Push
              </Space>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              로컬 데이터를 서버에 업로드합니다.
              Push 전 자동 백업이 생성됩니다.
            </Text>
            <Statistic title="마지막 Push" value="—" style={{ marginBottom: 16 }} />
            <Button icon={<CloudUploadOutlined />} block disabled>
              Push 실행 (Step 12)
            </Button>
          </Card>
        </Col>
      </Row>

      <Divider />

      {/* 버전 정보 */}
      <Card title="버전 정보" size="small">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic title="Base Version" value="—" />
          </Col>
          <Col span={8}>
            <Statistic title="현재 서버 버전" value="—" />
          </Col>
          <Col span={8}>
            <Statistic title="충돌 여부" value="—" />
          </Col>
        </Row>
      </Card>
    </div>
  );
}
