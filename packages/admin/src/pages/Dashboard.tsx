import { ApiOutlined, DollarOutlined, FireOutlined, MessageOutlined, UserOutlined } from '@ant-design/icons'
import { Card, Col, List, message, Row, Spin, Statistic, Tag } from 'antd'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'

import { statisticsApi } from '../services/api'
import { ECHARTS_THEME_NAME } from '../theme'

interface OverviewData {
  users: { total: number; active: number }
  models: number
  usage: {
    today: { messages: number; conversations: number; tokens: number; cost: number }
    month: { messages: number; conversations: number; tokens: number; cost: number }
    total: { messages: number; conversations: number; tokens: number; cost: number }
  }
}

interface UsageTrend {
  date: string
  messages: number
  conversations: number
  tokens: number
  cost: number
}

interface DepartmentStat {
  departmentId: string
  departmentName: string
  messages: number
  conversations: number
  tokens: number
  cost: number
  userCount: number
}

interface PresetStat {
  presetId: string
  presetName: string
  emoji: string | null
  messages: number
  conversations: number
  tokens: number
  cost: number
  uniqueUsers: number
}

interface ModelStat {
  modelId: string | null
  modelName: string
  messages: number
  conversations: number
  tokens: number
  cost: number
}

const STAT_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b']

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [usageTrend, setUsageTrend] = useState<UsageTrend[]>([])
  const [topDepartments, setTopDepartments] = useState<DepartmentStat[]>([])
  const [topPresets, setTopPresets] = useState<PresetStat[]>([])
  const [modelStats, setModelStats] = useState<ModelStat[]>([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const dateParams = {
        startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        groupBy: 'day'
      }

      const [overviewRes, usageRes, deptRes, presetRes, modelRes] = await Promise.all([
        statisticsApi.overview(),
        statisticsApi.usage(dateParams),
        statisticsApi.byDepartment(dateParams),
        statisticsApi.byAssistantPreset(dateParams),
        statisticsApi.byModel(dateParams)
      ])

      setOverview(overviewRes.data.data)
      setUsageTrend(usageRes.data.data)
      setTopDepartments((deptRes.data.data as DepartmentStat[]).slice(0, 5))
      setTopPresets((presetRes.data.data as PresetStat[]).slice(0, 10))
      setModelStats(modelRes.data.data)
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
      data: ['消息数', '对话数', 'Token 数']
    },
    xAxis: {
      type: 'category',
      data: usageTrend.map((d) => d.date)
    },
    yAxis: [
      { type: 'value', name: '消息 / 对话' },
      { type: 'value', name: 'Token 数' }
    ],
    series: [
      {
        name: '消息数',
        type: 'bar',
        data: usageTrend.map((d) => d.messages),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#6366f1' },
              { offset: 1, color: 'rgba(99,102,241,0.2)' }
            ]
          }
        }
      },
      {
        name: '对话数',
        type: 'bar',
        data: usageTrend.map((d) => d.conversations),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: 'rgba(16,185,129,0.2)' }
            ]
          }
        }
      },
      {
        name: 'Token 数',
        type: 'line',
        yAxisIndex: 1,
        data: usageTrend.map((d) => d.tokens),
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(6,182,212,0.3)' },
              { offset: 1, color: 'rgba(6,182,212,0.02)' }
            ]
          }
        }
      }
    ]
  }

  const departmentBarOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    xAxis: {
      type: 'value'
    },
    yAxis: {
      type: 'category',
      data: [...topDepartments].reverse().map((d) => d.departmentName),
      axisLabel: {
        width: 80,
        overflow: 'truncate'
      }
    },
    series: [
      {
        type: 'bar',
        data: [...topDepartments].reverse().map((d) => d.messages),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(99,102,241,0.4)' },
              { offset: 1, color: '#6366f1' }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        },
        barMaxWidth: 24
      }
    ],
    grid: {
      left: 100,
      right: 20,
      top: 10,
      bottom: 20
    }
  }

  const modelPieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        data: modelStats.slice(0, 8).map((m) => ({
          name: m.modelName,
          value: m.messages
        })),
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        }
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

  const statCards = [
    {
      title: '总用户数',
      value: overview?.users.total || 0,
      icon: <UserOutlined />,
      suffix: <span style={{ fontSize: 14, color: 'var(--cs-success)' }}>{overview?.users.active || 0} 活跃</span>,
      color: STAT_COLORS[0]
    },
    {
      title: '可用模型',
      value: overview?.models || 0,
      icon: <ApiOutlined />,
      color: STAT_COLORS[1]
    },
    {
      title: '今日消息',
      value: overview?.usage.today.messages || 0,
      icon: <MessageOutlined />,
      color: STAT_COLORS[2]
    },
    {
      title: '本月费用',
      value: overview?.usage.month.cost || 0,
      icon: <DollarOutlined />,
      precision: 2,
      color: STAT_COLORS[3]
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]}>
        {statCards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card className="stat-card" style={{ '--stat-color': card.color } as React.CSSProperties}>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={<span style={{ color: card.color }}>{card.icon}</span>}
                suffix={card.suffix}
                precision={card.precision}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="使用趋势 (近30天)">
            <ReactECharts theme={ECHARTS_THEME_NAME} option={usageChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="本月统计">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="消息总数" value={overview?.usage.month.messages || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="Token 总数" value={overview?.usage.month.tokens || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="对话总数" value={overview?.usage.month.conversations || 0} />
              </Col>
              <Col span={12}>
                <Statistic title="总费用" value={overview?.usage.total.cost || 0} precision={2} prefix="¥" />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="部门 Top 5 (消息量)">
            {topDepartments.length > 0 ? (
              <ReactECharts theme={ECHARTS_THEME_NAME} option={departmentBarOption} style={{ height: 260 }} />
            ) : (
              <div
                style={{
                  height: 260,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cs-text-3)'
                }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="模型分布">
            {modelStats.length > 0 ? (
              <ReactECharts theme={ECHARTS_THEME_NAME} option={modelPieOption} style={{ height: 260 }} />
            ) : (
              <div
                style={{
                  height: 260,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cs-text-3)'
                }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <FireOutlined style={{ color: 'var(--cs-error)', marginRight: 8 }} />
                热门助手预设 Top 10
              </span>
            }>
            {topPresets.length > 0 ? (
              <List
                size="small"
                dataSource={topPresets}
                style={{ maxHeight: 260, overflow: 'auto' }}
                renderItem={(item, index) => (
                  <List.Item style={{ padding: '6px 0', borderBottomColor: 'var(--cs-border)' }}>
                    <span>
                      <Tag color={index < 3 ? 'magenta' : 'default'} style={{ minWidth: 24, textAlign: 'center' }}>
                        {index + 1}
                      </Tag>
                      {item.emoji ? `${item.emoji} ` : ''}
                      {item.presetName}
                    </span>
                    <span style={{ color: 'var(--cs-text-3)', fontSize: 12 }}>
                      {item.messages} 次 · {item.uniqueUsers} 用户
                    </span>
                  </List.Item>
                )}
              />
            ) : (
              <div
                style={{
                  height: 260,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cs-text-3)'
                }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
