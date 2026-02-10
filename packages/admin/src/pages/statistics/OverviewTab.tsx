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
    const messages = usageData.reduce((sum, d) => sum + d.messages, 0)
    const conversations = usageData.reduce((sum, d) => sum + d.conversations, 0)
    const tokens = usageData.reduce((sum, d) => sum + d.tokens, 0)
    const cost = usageData.reduce((sum, d) => sum + d.cost, 0)
    return { messages, conversations, tokens, cost }
  }, [usageData])

  const usageChartOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { data: ['消息数', '对话数', 'Token 数', '费用'] },
      xAxis: {
        type: 'category',
        data: usageData.map((d) => d.date)
      },
      yAxis: [
        { type: 'value', name: '消息 / 对话' },
        { type: 'value', name: 'Token / 费用' }
      ],
      series: [
        {
          name: '消息数',
          type: 'bar',
          data: usageData.map((d) => d.messages)
        },
        {
          name: '对话数',
          type: 'bar',
          data: usageData.map((d) => d.conversations)
        },
        {
          name: 'Token 数',
          type: 'line',
          yAxisIndex: 1,
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
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总消息数" value={summary.messages} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总对话数" value={summary.conversations} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总 Token 数" value={summary.tokens} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
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
