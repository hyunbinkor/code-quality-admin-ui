/**
 * src/pages/SyncPage.tsx
 *
 * 데이터 동기화 페이지.
 * - Pull  : 서버 → 로컬
 * - Diff  : 로컬 vs 서버 비교 → DiffViewer
 * - Push  : 로컬 → 서버, PushConfirm 다이얼로그, 충돌 처리
 */
import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  ClockCircleOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import { diffData } from '@/api/dataApi';
import DiffViewer from '@/components/sync/DiffViewer';
import PushConfirm from '@/components/sync/PushConfirm';
import type { DiffResponse } from '@/types/api';

const { Title, Text } = Typography;

function formatDateTime(iso: string | null): string {
  if (!iso) return '없음';
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function SyncPage() {
  const rules            = useDataStore((s) => s.rules);
  const tags             = useDataStore((s) => s.tags);
  const baseVersion      = useDataStore((s) => s.baseVersion);
  const lastPullAt       = useDataStore((s) => s.lastPullAt);
  const lastPushAt       = useDataStore((s) => s.lastPushAt);
  const isLoading        = useDataStore((s) => s.isLoading);
  const pull             = useDataStore((s) => s.pull);
  const applyPushSuccess = useDataStore((s) => s.applyPushSuccess);
  const notifySuccess    = useUiStore((s) => s.notifySuccess);
  const notifyError      = useUiStore((s) => s.notifyError);

  const [diffResult, setDiffResult]     = useState<DiffResponse | null>(null);
  const [diffLoading, setDiffLoading]   = useState(false);
  const [diffError, setDiffError]       = useState<string | null>(null);
  const [pushOpen, setPushOpen]         = useState(false);

  const hasPullData = baseVersion !== null;

  // ── Pull ──────────────────────────────────────────────────────────────────
  const handlePull = async () => {
    try {
      await pull();
      setDiffResult(null);
      notifySuccess('Pull 완료', '서버에서 최신 데이터를 불러왔습니다.');
    } catch (err) {
      notifyError('Pull 실패', err instanceof Error ? err.message : undefined);
    }
  };

  // ── Diff ──────────────────────────────────────────────────────────────────
  const handleDiff = async () => {
    if (baseVersion === null) {
      notifyError('Diff 실패', 'Pull을 먼저 실행하세요.');
      return;
    }
    setDiffLoading(true);
    setDiffError(null);
    try {
      const result = await diffData({ baseVersion, rules, tags });
      setDiffResult(result);
      notifySuccess('Diff 완료', '변경사항 비교가 완료되었습니다.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diff 요청 실패';
      setDiffError(msg);
      notifyError('Diff 실패', msg);
    } finally {
      setDiffLoading(false);
    }
  };

  // ── Push 성공 콜백 ────────────────────────────────────────────────────────
  const handlePushSuccess = async (newVersion: number) => {
    const pushedAt = new Date().toISOString();
    await applyPushSuccess(newVersion, pushedAt);
    setDiffResult(null); // Push 완료 후 Diff 결과 초기화
    notifySuccess('Push 완료', `새 버전: ${newVersion}`);
  };

  // ── PushConfirm에 전달할 payload 생성 ────────────────────────────────────
  const getPushPayload = (force: boolean) => ({
    baseVersion:  baseVersion ?? undefined,
    rules,
    tags,
    force,
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>데이터 동기화</Title>

      {/* ── 현재 상태 카드 ───────────────────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="baseVersion"
              value={baseVersion ?? '없음 (Pull 필요)'}
              valueStyle={{
                fontSize: 13,
                fontFamily: 'monospace',
                color: hasPullData ? undefined : '#bfbfbf',
              }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={<Space><ClockCircleOutlined />마지막 Pull</Space>}
              value={formatDateTime(lastPullAt)}
              valueStyle={{ fontSize: 13, color: lastPullAt ? '#1677ff' : '#bfbfbf' }}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title={<Space><ClockCircleOutlined />마지막 Push</Space>}
              value={formatDateTime(lastPushAt)}
              valueStyle={{ fontSize: 13, color: lastPushAt ? '#52c41a' : '#bfbfbf' }}
            />
          </Col>
        </Row>

        <Divider style={{ margin: '16px 0' }} />

        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>로컬 데이터:</Text>
          <Tag color="blue">{rules.length}개 규칙</Tag>
          <Tag color="purple">{Object.keys(tags.tags).length}개 태그</Tag>
          <Tag color="cyan">{Object.keys(tags.compoundTags).length}개 복합 태그</Tag>
        </Space>
      </Card>

      {/* ── 액션 카드 3열 ────────────────────────────────────────────────── */}
      <Card title="동기화 작업" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {/* Pull */}
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{ textAlign: 'center', background: '#e6f4ff', border: '1px solid #91caff' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <CloudDownloadOutlined style={{ fontSize: 28, color: '#1677ff' }} />
                <Text strong>Pull</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  서버 데이터를 로컬로 가져옵니다.
                  <br />기존 로컬 편집이 덮어씌워집니다.
                </Text>
                <Button
                  type="primary"
                  icon={<CloudDownloadOutlined />}
                  onClick={handlePull}
                  loading={isLoading}
                  block
                >
                  Pull 실행
                </Button>
              </Space>
            </Card>
          </Col>

          {/* Diff */}
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{ textAlign: 'center', background: '#fffbe6', border: '1px solid #ffe58f' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <DiffOutlined style={{ fontSize: 28, color: '#d48806' }} />
                <Text strong>Diff</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  로컬 편집본과 서버를 비교합니다.
                  <br />Push 전에 변경사항을 확인하세요.
                </Text>
                <Button
                  icon={<DiffOutlined />}
                  onClick={handleDiff}
                  loading={diffLoading}
                  disabled={!hasPullData}
                  block
                >
                  Diff 실행
                </Button>
              </Space>
            </Card>
          </Col>

          {/* Push */}
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{ textAlign: 'center', background: '#f6ffed', border: '1px solid #b7eb8f' }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <CloudUploadOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                <Text strong>Push</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  로컬 데이터를 서버에 업로드합니다.
                  <br />서버 데이터는 자동 백업됩니다.
                </Text>
                <Button
                  icon={<CloudUploadOutlined />}
                  onClick={() => setPushOpen(true)}
                  disabled={!hasPullData}
                  style={
                    hasPullData
                      ? { background: '#52c41a', borderColor: '#52c41a', color: '#fff' }
                      : {}
                  }
                  block
                >
                  Push 실행
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* ── Pull 안내 ────────────────────────────────────────────────────── */}
      {!hasPullData && (
        <Alert
          type="info"
          showIcon
          message="Pull이 필요합니다"
          description="Diff / Push를 실행하려면 먼저 Pull을 실행하여 서버 데이터를 가져오세요."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Diff 에러 ────────────────────────────────────────────────────── */}
      {diffError && (
        <Alert
          type="error"
          showIcon
          message="Diff 요청 실패"
          description={diffError}
          closable
          onClose={() => setDiffError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── Diff 결과 ────────────────────────────────────────────────────── */}
      <Spin spinning={diffLoading}>
        {diffResult && (
          <>
            <Divider>
              <Text type="secondary" style={{ fontSize: 13 }}>Diff 결과</Text>
            </Divider>
            <DiffViewer diff={diffResult} />
          </>
        )}
      </Spin>

      {/* ── Push 확인 모달 ───────────────────────────────────────────────── */}
      <PushConfirm
        open={pushOpen}
        diff={diffResult}
        baseVersion={baseVersion}
        ruleCount={rules.length}
        tagCount={Object.keys(tags.tags).length}
        onPushSuccess={handlePushSuccess}
        onPullRequested={handlePull}
        onClose={() => setPushOpen(false)}
        getPushPayload={getPushPayload}
      />
    </div>
  );
}