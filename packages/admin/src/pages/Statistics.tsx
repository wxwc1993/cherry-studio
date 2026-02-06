import { DownloadOutlined } from '@ant-design/icons'
import { Button, Card, Col, DatePicker, message, Row, Select, Spin, Statistic, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'

import { departmentsApi, modelsApi, statisticsApi } from '../services/api'

const { RangePicker } = DatePicker

interface UsageData {
  date: string
  requests: number
  tokens: number
  cost: number
}

interface ModelUsage {
  modelId: string
  modelName: string
  requests: number
  tokens: number
  cost: number
}

interface UserUsage {
  userId: string
  userName: string
  department: string
  requests: number
  tokens: number
  cost: number
}

interface Model {
  id: string
  displayName: string
}

interface Department {
  id: string
  name: string
}

export default function Statistics() {
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const [modelId, setModelId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([])
  const [userUsage, setUserUsage] = useState<UserUsage[]>([])
  const [summary, setSummary] = useState({ requests: 0, tokens: 0, cost: 0 })

  const [models, setModels] = useState<Model[]>([])
  const [departments, setDepartments] = useState<Department[]>([])

  useEffect(() => {
    loadFilters()
  }, [])

  useEffect(() => {
    loadData()
  }, [dateRange, modelId, departmentId, groupBy])

  const loadFilters = async () => {
    try {
      const [modelsRes, deptsRes] = await Promise.all([modelsApi.list(), departmentsApi.list()])
      setModels(modelsRes.data.data)
      setDepartments(deptsRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载筛选条件失败')
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        modelId: modelId || undefined,
        departmentId: departmentId || undefined,
        groupBy
      }

      const [usageRes, modelRes, userRes] = await Promise.all([
        statisticsApi.usage(params),
        statisticsApi.byModel(params),
        statisticsApi.byUser(params)
      ])

      setUsageData(usageRes.data.data)
      setModelUsage(modelRes.data.data)
      setUserUsage(userRes.data.data)

      // Calculate summary
      const totalRequests = usageRes.data.data.reduce((sum: number, d: UsageData) => sum + d.requests, 0)
      const totalTokens = usageRes.data.data.reduce((sum: number, d: UsageData) => sum + d.tokens, 0)
      const totalCost = usageRes.data.data.reduce((sum: number, d: UsageData) => sum + d.cost, 0)
      setSummary({ requests: totalRequests, tokens: totalTokens, cost: totalCost })
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        modelId: modelId || undefined,
        departmentId: departmentId || undefined
      }
      const response = await statisticsApi.export(params)
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `usage-${dateRange[0].format('YYYYMMDD')}-${dateRange[1].format('YYYYMMDD')}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      message.success('导出成功')
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '导出失败')
    }
  }

  const usageChartOption = {
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['请求数', 'Token 数', '费用']
    },
    xAxis: {
      type: 'category',
      data: usageData.map((d) => d.date)
    },
    yAxis: [
      { type: 'value', name: '请求数 / Token' },
      { type: 'value', name: '费用 ($)' }
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
  }

  const modelPieOption = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: modelUsage.map((m) => ({
          name: m.modelName,
          value: m.requests
        }))
      }
    ]
  }

  const modelColumns: ColumnsType<ModelUsage> = [
    { title: '模型', dataIndex: 'modelName', key: 'modelName' },
    { title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },
    { title: 'Token 数', dataIndex: 'tokens', key: 'tokens', sorter: (a, b) => a.tokens - b.tokens },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost) => `$${cost.toFixed(2)}`
    }
  ]

  const userColumns: ColumnsType<UserUsage> = [
    { title: '用户', dataIndex: 'userName', key: 'userName' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },
    { title: 'Token 数', dataIndex: 'tokens', key: 'tokens', sorter: (a, b) => a.tokens - b.tokens },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost) => `$${cost.toFixed(2)}`
    }
  ]

  if (loading && usageData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  // 空数据状态处理
  const _hasData = usageData.length > 0 || modelUsage.length > 0 || userUsage.length > 0

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker value={dateRange} onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])} />
          </Col>
          <Col>
            <Select
              style={{ width: 150 }}
              placeholder="选择模型"
              allowClear
              value={modelId}
              onChange={setModelId}
              options={models.map((m) => ({ label: m.displayName, value: m.id }))}
            />
          </Col>
          <Col>
            <Select
              style={{ width: 150 }}
              placeholder="选择部门"
              allowClear
              value={departmentId}
              onChange={setDepartmentId}
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
            />
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
          <Col>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
          </Col>
        </Row>
      </Card>

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
            <Statistic title="总费用" value={summary.cost} precision={2} prefix="$" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="使用趋势" loading={loading}>
            <ReactECharts option={usageChartOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="模型分布" loading={loading}>
            <ReactECharts option={modelPieOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="模型使用统计" loading={loading}>
            <Table rowKey="modelId" columns={modelColumns} dataSource={modelUsage} pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="用户使用统计" loading={loading}>
            <Table
              rowKey="userId"
              columns={userColumns}
              dataSource={userUsage}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
