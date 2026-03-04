/**
 * src/pages/DashboardPage.tsx
 *
 * 대시보드 페이지.
 *   - /health 30초 폴링 (usePollHealth)
 *   - /api/data/stats 통계 위젯 (규칙 수, 태그 수, 카테고리 분포)
 *   - 마지막 Pull / Push 시각 (dataStore에서 읽기)
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Space,
  Button,
  Progress,
  Divider,
  Alert,
  Spin,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import usePollHealth from '@/hooks/usePollHealth';
import ServerStatus from '@/components/common/ServerStatus';
import { getStats } from '@/api/dataApi';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { StatsResponse } from '@/types/api';
import { RULE_CATEGORY_LABELS } from '@/types/rule';

const { Title, Text } = Typography;

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#f5222d',
  '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#a0d911',
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '없음';
  return new Date(iso).toLocaleString('ko-KR', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function DashboardPage() {
  usePollHealth();

  const lastPullAt = useDataStore((s) => s.lastPullAt);
  const lastPushAt = useDataStore((s) => s.lastPushAt);
  const rules      = useDataStore((s) => s.rules);
  const notifyError = useUiStore((s) => s.notifyError);

  const [stats, setStats]           = useState<StatsResponse['stats'] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError]   = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await getStats();
      setStats(res.stats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '통계 조회 실패';
      setStatsError(msg);
      notifyError('통계 조회 실패', msg);
    } finally {
      setStatsLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 로컬 규칙 기반 카테고리별 집계
  const categoryCounts = rules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.category] = (acc[rule.category] ?? 0) + 1;
    return acc;
  }, {});
  const totalRules     = rules.length;
  const activeRules    = rules.filter((r) => r.isActive).length;

  return (
    <div>
      {/* ── 타이틀 ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>대시보드</Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchStats}
          loading={statsLoading}
        >
          통계 새로고침
        </Button>
      </div>

      {/* ── 서버 연결 상태 ───────────────────────────────────────────────── */}
      <Card
        title={<Space><ApiOutlined />서버 연결 상태</Space>}
        size="small"
        style={{ marginBottom: 24 }}
      >
        <Space size={16}>
          <ServerStatus />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {import.meta.env.VITE_API_URL || 'http://localhost:3000'}
            &nbsp;·&nbsp;30초 간격 자동 확인
          </Text>
        </Space>
      </Card>

      {/* ── 통계 카드 4개 ────────────────────────────────────────────────── */}
      <Spin spinning={statsLoading}>
        {statsError && (
          <Alert
            type="warning"
            showIcon
            message="서버 통계를 불러오지 못했습니다."
            description="서버 연결을 확인하세요. 아래 수치는 로컬 데이터 기준입니다."
            closable
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="전체 규칙"
                value={stats?.rules.count ?? (totalRules || '—')}
                prefix={<FileTextOutlined />}
                suffix={stats || totalRules > 0 ? '개' : ''}
                valueStyle={{ color: '#1677ff' }}
              />
              {!stats && totalRules > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>로컬 기준</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="활성 규칙"
                value={totalRules > 0 ? activeRules : '—'}
                prefix={<FileTextOutlined />}
                suffix={totalRules > 0 ? '개' : ''}
                valueStyle={{ color: '#52c41a' }}
              />
              {totalRules > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>로컬 기준</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="전체 태그"
                value={stats?.tags.count ?? '—'}
                prefix={<TagsOutlined />}
                suffix={stats ? '개' : ''}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="복합 태그"
                value={stats?.tags.compoundCount ?? '—'}
                prefix={<TagsOutlined />}
                suffix={stats ? '개' : ''}
                valueStyle={{ color: '#13c2c2' }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* ── 하단 2열 ─────────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 카테고리별 규칙 분포 */}
        <Col xs={24} lg={12}>
          <Card
            title={<Space><AppstoreOutlined />카테고리별 규칙 분포</Space>}
            style={{ minHeight: 280 }}
          >
            {totalRules === 0 ? (
              <Text type="secondary">
                Pull을 실행하면 카테고리 분포가 표시됩니다.
              </Text>
            ) : (
              Object.entries(categoryCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count], idx) => {
                  const label =
                    RULE_CATEGORY_LABELS[
                      category as keyof typeof RULE_CATEGORY_LABELS
                    ] ?? category;
                  const percent = Math.round((count / totalRules) * 100);

                  return (
                    <div key={category} style={{ marginBottom: 10 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 2,
                        }}
                      >
                        <Text style={{ fontSize: 13 }}>{label}</Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {count}개 ({percent}%)
                        </Text>
                      </div>
                      <Tooltip title={`${count}개 / 전체 ${totalRules}개`}>
                        <Progress
                          percent={percent}
                          strokeColor={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                          showInfo={false}
                          size="small"
                        />
                      </Tooltip>
                    </div>
                  );
                })
            )}
          </Card>
        </Col>

        {/* 동기화 현황 */}
        <Col xs={24} lg={12}>
          <Card
            title={<Space><ClockCircleOutlined />동기화 현황</Space>}
            style={{ minHeight: 280 }}
          >
            <Statistic
              title="마지막 Pull"
              value={formatDateTime(lastPullAt)}
              valueStyle={{ fontSize: 15, color: lastPullAt ? '#1677ff' : '#bfbfbf' }}
            />

            <Divider style={{ margin: '16px 0' }} />

            <Statistic
              title="마지막 Push"
              value={formatDateTime(lastPushAt)}
              valueStyle={{ fontSize: 15, color: lastPushAt ? '#52c41a' : '#bfbfbf' }}
            />

            <Divider style={{ margin: '16px 0' }} />

            <Statistic
              title="로컬 데이터"
              value={totalRules > 0 ? `규칙 ${totalRules}개 로드됨` : 'Pull이 필요합니다'}
              valueStyle={{ fontSize: 15, color: totalRules > 0 ? '#52c41a' : '#bfbfbf' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 태그 카테고리 목록 (서버 응답 기준) */}
      {stats && stats.tags.categories.length > 0 && (
        <Card
          title="태그 카테고리 (서버 기준)"
          size="small"
          style={{ marginTop: 16 }}
        >
          <Space wrap>
            {stats.tags.categories.map((cat) => (
              <Text key={cat} code style={{ fontSize: 12 }}>{cat}</Text>
            ))}
          </Space>
        </Card>
      )}
    </div>
  );
}