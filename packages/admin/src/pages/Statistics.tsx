import {
  ApartmentOutlined,
  ApiOutlined,
  DownloadOutlined,
  LineChartOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Button, Card, Col, DatePicker, message, Row, Select, Spin, Tabs } from 'antd'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

import { departmentsApi, modelsApi, statisticsApi } from '../services/api'
import DepartmentTab from './statistics/DepartmentTab'
import ModelTab from './statistics/ModelTab'
import OverviewTab from './statistics/OverviewTab'
import PresetTab from './statistics/PresetTab'
import type {
  DepartmentUsage,
  FilterDepartment,
  FilterModel,
  ModelUsage,
  PresetUsage,
  UsageData,
  UserUsage
} from './statistics/types'
import UserTab from './statistics/UserTab'

const { RangePicker } = DatePicker

export default function Statistics() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const [modelId, setModelId] = useState<string | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  const [usageData, setUsageData] = useState<UsageData[]>([])
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([])
  const [userUsage, setUserUsage] = useState<UserUsage[]>([])
  const [departmentUsage, setDepartmentUsage] = useState<DepartmentUsage[]>([])
  const [presetUsage, setPresetUsage] = useState<PresetUsage[]>([])

  const [models, setModels] = useState<FilterModel[]>([])
  const [departments, setDepartments] = useState<FilterDepartment[]>([])

  const loadFilters = useCallback(async () => {
    try {
      const [modelsRes, deptsRes] = await Promise.all([modelsApi.list(), departmentsApi.list()])
      setModels(modelsRes.data.data)
      setDepartments(deptsRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载筛选条件失败')
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
        modelId: modelId || undefined,
        departmentId: departmentId || undefined,
        groupBy
      }

      const [usageRes, modelRes, userRes, deptRes, presetRes] = await Promise.all([
        statisticsApi.usage(params),
        statisticsApi.byModel(params),
        statisticsApi.byUser(params),
        statisticsApi.byDepartment(params),
        statisticsApi.byAssistantPreset(params)
      ])

      // [DEBUG] 调试仪表盘图表无数据问题，调试完成后移除
      console.warn('[DEBUG] Statistics params:', params)
      console.warn('[DEBUG] usage:', usageRes.data.data?.length, usageRes.data.data?.slice(0, 2))
      console.warn('[DEBUG] models:', modelRes.data.data?.length, modelRes.data.data?.slice(0, 2))
      console.warn('[DEBUG] users:', userRes.data.data?.length, userRes.data.data?.slice(0, 2))
      console.warn('[DEBUG] departments:', deptRes.data.data?.length, deptRes.data.data?.slice(0, 2))
      console.warn('[DEBUG] presets:', presetRes.data.data?.length, presetRes.data.data?.slice(0, 2))

      setUsageData(usageRes.data.data)
      setModelUsage(modelRes.data.data)
      setUserUsage(userRes.data.data)
      setDepartmentUsage(deptRes.data.data)
      setPresetUsage(presetRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载数据失败')
    } finally {
      setLoading(false)
    }
  }, [dateRange, modelId, departmentId, groupBy])

  useEffect(() => {
    loadFilters()
  }, [loadFilters])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExport = useCallback(async () => {
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
  }, [dateRange, modelId, departmentId])

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <LineChartOutlined />
          概览
        </span>
      ),
      children: <OverviewTab loading={loading} usageData={usageData} />
    },
    {
      key: 'departments',
      label: (
        <span>
          <ApartmentOutlined />
          部门统计
        </span>
      ),
      children: <DepartmentTab loading={loading} departmentData={departmentUsage} />
    },
    {
      key: 'models',
      label: (
        <span>
          <ApiOutlined />
          模型统计
        </span>
      ),
      children: <ModelTab loading={loading} modelData={modelUsage} />
    },
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined />
          用户统计
        </span>
      ),
      children: <UserTab loading={loading} userData={userUsage} />
    },
    {
      key: 'presets',
      label: (
        <span>
          <RobotOutlined />
          助手预设统计
        </span>
      ),
      children: <PresetTab loading={loading} presetData={presetUsage} />
    }
  ]

  if (loading && usageData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
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

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  )
}
