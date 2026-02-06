import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin, message } from 'antd'
import { UserOutlined, MessageOutlined, ApiOutlined, DollarOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { statisticsApi } from '../services/api'
import dayjs from 'dayjs'

interface OverviewData {
  users: { total: number; active: number }
  models: number
  conversations: number
  usage: {
    today: { requests: number; tokens: number; cost: number }
    month: { requests: number; tokens: number; cost: number }
    total: { requests: number; tokens: number; cost: number }
  }
}

interface UsageTrend {
  date: string
  requests: number
  tokens: number
  cost: number
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [usageTrend, setUsageTrend] = useState<UsageTrend[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [overviewRes, usageRes] = await Promise.all([
        statisticsApi.overview(),
        statisticsApi.usage({
          startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().format('YYYY-MM-DD'),
          groupBy: 'day'
        })
      ])
      setOverview(overviewRes.data.data)
      setUsageTrend(usageRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const usageChartOption = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['请求数', 'Token 数']
    },
    xAxis: {
      type: 'category',
      data: usageTrend.map((d) => d.date)
    },
    yAxis: [
      { type: 'value', name: '请求数' },
      { type: 'value', name: 'Token 数' }
    ],
    series: [
      {
        name: '请求数',
        type: 'bar',
        data: usageTrend.map((d) => d.requests)
      },
      {
        name: 'Token 数',
        type: 'line',
        yAxisIndex: 1,
        data: usageTrend.map((d) => d.tokens)
      }
    ]
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={overview?.users.total || 0}
              prefix={<UserOutlined />}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}>{overview?.users.active || 0} 活跃</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="可用模型" value={overview?.models || 0} prefix={<ApiOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日请求" value={overview?.usage.today.requests || 0} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="本月费用"
              value={overview?.usage.month.cost || 0}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="使用趋势 (近30天)">
            <ReactECharts option={usageChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="本月统计">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="请求总数" value={overview?.usage.month.requests || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="Token 总数" value={overview?.usage.month.tokens || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="对话总数" value={overview?.conversations || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="总费用" value={overview?.usage.total.cost || 0} precision={2} prefix="$" />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
