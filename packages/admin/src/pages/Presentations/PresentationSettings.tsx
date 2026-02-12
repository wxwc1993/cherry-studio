import { SaveOutlined } from '@ant-design/icons'
import { Button, Card, Checkbox, Form, InputNumber, message, Select, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { modelsApi } from '../../services/api'
import { presentationsApi } from '../../services/presentationsApi'
import { useAuthStore } from '../../store/auth'
import type { PresentationSettingsData } from './types'

interface ModelOption {
  id: string
  displayName: string
}

const EXPORT_FORMAT_OPTIONS = [
  { label: 'PPTX', value: 'pptx' },
  { label: 'PDF', value: 'pdf' },
  { label: '可编辑 PPTX', value: 'editable_pptx' }
]

export default function PresentationSettings() {
  const { hasPermission } = useAuthStore()
  const canAdmin = hasPermission('presentations', 'admin')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<ModelOption[]>([])
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [settingsRes, modelsRes] = await Promise.all([presentationsApi.getSettings(), modelsApi.list()])
      const settings: PresentationSettingsData = settingsRes.data.data
      setModels(modelsRes.data.data ?? [])

      form.setFieldsValue({
        defaultTextModelId: settings.defaultTextModelId ?? undefined,
        defaultImageModelId: settings.defaultImageModelId ?? undefined,
        maxConcurrentTasks: settings.config.maxConcurrentTasks ?? 5,
        maxPages: settings.config.maxPages ?? 50,
        enabledExportFormats: settings.config.enabledExportFormats ?? ['pptx', 'pdf']
      })
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message ?? '加载设置失败')
    } finally {
      setLoading(false)
    }
  }, [form])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const data = {
        defaultTextModelId: values.defaultTextModelId ?? null,
        defaultImageModelId: values.defaultImageModelId ?? null,
        config: {
          maxConcurrentTasks: values.maxConcurrentTasks,
          maxPages: values.maxPages,
          enabledExportFormats: values.enabledExportFormats
        }
      }

      await presentationsApi.updateSettings(data)
      message.success('设置已保存')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      if (err.response) {
        message.error(err.response?.data?.error?.message ?? '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!canAdmin) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--cs-text-3)' }}>需要管理员权限</div>
  }

  const modelOptions = models.map((m) => ({ value: m.id, label: m.displayName }))

  return (
    <Card title="PPT 模块全局设置">
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item name="defaultTextModelId" label="默认文本模型">
          <Select
            options={modelOptions}
            allowClear
            placeholder="选择默认文本模型"
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item name="defaultImageModelId" label="默认图像模型">
          <Select
            options={modelOptions}
            allowClear
            placeholder="选择默认图像模型"
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="maxConcurrentTasks"
          label="最大并发任务数"
          rules={[{ required: true, message: '请输入并发数' }]}>
          <InputNumber min={1} max={50} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="maxPages" label="单个 PPT 最大页数" rules={[{ required: true, message: '请输入最大页数' }]}>
          <InputNumber min={1} max={200} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="enabledExportFormats" label="启用的导出格式">
          <Checkbox.Group options={EXPORT_FORMAT_OPTIONS} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
