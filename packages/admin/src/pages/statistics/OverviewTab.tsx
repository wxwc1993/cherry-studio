import { Card, Col, Row, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

import { ECHARTS_THEME_NAME } from '../../theme'
import type { UsageData } from './types'

interface OverviewTabProps {
  loading: boolean
  usageData: UsageData[]
}

export default function OverviewTab({ loading, usageData }: OverviewTabProps) {
  const summary = useMemo(() => {
    const requests = usageData.reduce((sum, d) => sum + d.requests, 0)
    const tokens = usageData.reduce((sum, d) => sum + d.tokens, 0)
    const cost = usageData.reduce((sum, d) => sum + d.cost, 0)
    return { requests, tokens, cost }
  }, [usageData])

  const usageChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['请求数', 'Token 数', '费用'] },
      xAxis: {
        type: 'category',
        data: usageData.map((d) => d.date)
      },
      yAxis: [
        { type: 'value', name: '请求数 / Token' },
        { type: 'value', name: '费用 (¥)' }
      ],
      series: [
        {
          name: '请求数',
          type: 'bar',
          data: usageData.map((d) => d.requests)
        },
        {
          name: 'Token 数',
          type: 'line',
          data: usageData.map((d) => d.tokens)
        },
        {
          name: '费用',
          type: 'line',
          yAxisIndex: 1,
          data: usageData.map((d) => d.cost)
        }
      ]
    }),
    [usageData]
  )

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="总请求数" value={summary.requests} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="总 Token 数" value={summary.tokens} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="总费用" value={summary.cost} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Card title="使用趋势" loading={loading} style={{ marginTop: 16 }}>
        <ReactECharts theme={ECHARTS_THEME_NAME} option={usageChartOption} style={{ height: 400 }} />
      </Card>
    </div>
  )
}
