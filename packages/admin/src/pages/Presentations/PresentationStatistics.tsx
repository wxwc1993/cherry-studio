import { Card, Col, DatePicker, Row, Select, Spin, Statistic } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { presentationsApi } from '../../services/presentationsApi'
import { ECHARTS_THEME_NAME } from '../../theme'
import type { PresentationStatsData, PresentationUsageTrendItem } from './types'

const { RangePicker } = DatePicker

const EMPTY_STATS: PresentationStatsData = {
  totalPresentations: 0,
  totalExports: 0,
  totalAiCalls: 0,
  activeUsers: 0
}

export default function PresentationStatistics() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [stats, setStats] = useState<PresentationStatsData>(EMPTY_STATS)
  const [trend, setTrend] = useState<PresentationUsageTrendItem[]>([])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        groupBy
      }
      const response = await presentationsApi.statistics(params)
      const data = response.data.data
      setStats({
        totalPresentations: data.totalPresentations ?? 0,
        totalExports: data.totalExports ?? 0,
        totalAiCalls: data.totalAiCalls ?? 0,
        activeUsers: data.activeUsers ?? 0
      })
      setTrend(data.trend ?? [])
    } catch {
      // 统计加载失败时使用空数据
      setStats(EMPTY_STATS)
      setTrend([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, groupBy])

  useEffect(() => {
    loadData()
  }, [loadData])

  const trendChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['创建数量'] },
      xAxis: {
        type: 'category',
        data: trend.map((d) => d.date)
      },
      yAxis: { type: 'value', name: '数量' },
      series: [
        {
          name: '创建数量',
          type: 'bar',
          data: trend.map((d) => d.count),
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }
      ]
    }),
    [trend]
  )

  if (loading && trend.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker value={dateRange} onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])} />
          </Col>
          <Col>
            <Select
              style={{ width: 100 }}
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { label: '按日', value: 'day' },
                { label: '按周', value: 'week' },
                { label: '按月', value: 'month' }
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="演示文稿总数" value={stats.totalPresentations} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="导出总数" value={stats.totalExports} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="AI 调用总数" value={stats.totalAiCalls} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="活跃用户数" value={stats.activeUsers} />
          </Card>
        </Col>
      </Row>

      <Card title="使用趋势" loading={loading}>
        <ReactECharts theme={ECHARTS_THEME_NAME} option={trendChartOption} style={{ height: 400 }} />
      </Card>
    </div>
  )
}
