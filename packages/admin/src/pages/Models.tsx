import {
  CloudDownloadOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined
} from '@ant-design/icons'
import {
  CUSTOM_PROVIDER_SENTINEL,
  ENTERPRISE_PROVIDER_IDS,
  getProviderOptions,
  PROVIDER_DISPLAY_NAMES
} from '@cherry-studio/enterprise-shared'
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Timeline
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

import ProviderLogo from '../components/ProviderLogo'
import { departmentsApi, modelsApi, rolesApi } from '../services/api'
import { useAuthStore } from '../store/auth'
import FetchModelsPopup from './FetchModelsPopup'

interface Model {
  id: string
  provider: string
  name: string
  displayName: string
  enabled: boolean
  capabilities?: string[]
  quotaLimit?: {
    daily?: number
    monthly?: number
    perUser?: number
  }
  config?: {
    providerDisplayName?: string
    capabilities?: string[]
  }
  createdAt: string
}

interface PricingHistory {
  id: string
  inputPerMillionTokens: number
  outputPerMillionTokens: number
  currency: string
  effectiveFrom: string
  effectiveTo: string | null
  createdByName: string | null
  note: string | null
}

/**
 * 模型能力标签选项
 */
const capabilityOptions = [
  { label: '视觉理解', value: 'vision', color: 'green' },
  { label: '深度推理', value: 'reasoning', color: 'blue' },
  { label: '文本嵌入', value: 'embedding', color: 'purple' },
  { label: '函数调用', value: 'function_calling', color: 'orange' },
  { label: '网络搜索', value: 'web_search', color: 'cyan' },
  { label: '重排序', value: 'rerank', color: 'magenta' },
  { label: '免费', value: 'free', color: 'gold' }
]

interface Department {
  id: string
  name: string
}

interface Role {
  id: string
  name: string
}

/**
 * 供应商选项列表，从 enterprise-shared 包生成
 * 与客户端 SystemProviderId 完全对齐，附带图标
 */
const providerOptions = getProviderOptions().map((opt) => ({
  ...opt,
  label: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ProviderLogo providerId={opt.value} providerName={String(opt.label)} size={18} />
      <span>{opt.label}</span>
    </div>
  )
}))

export default function Models() {
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [fetchModelsOpen, setFetchModelsOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [pricingModalOpen, setPricingModalOpen] = useState(false)
  const [pricingHistoryModalOpen, setPricingHistoryModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [selectedModelName, setSelectedModelName] = useState('')
  const [pricingHistory, setPricingHistory] = useState<PricingHistory[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)
  const [isCustomProvider, setIsCustomProvider] = useState(false)
  const [form] = Form.useForm()
  const [permissionForm] = Form.useForm()
  const [pricingForm] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canSettings = hasPermission('system', 'settings')

  useEffect(() => {
    loadData()
    loadDepartmentsAndRoles()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await modelsApi.list()
      setModels(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载模型列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartmentsAndRoles = async () => {
    try {
      const [deptRes, roleRes] = await Promise.all([departmentsApi.list(), rolesApi.list()])
      setDepartments(deptRes.data.data)
      setRoles(roleRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载部门和角色信息失败')
    }
  }

  const handleAdd = () => {
    setEditingModel(null)
    setIsCustomProvider(false)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (model: Model) => {
    const isCustom = !(model.provider in ENTERPRISE_PROVIDER_IDS)
    setEditingModel(model)
    setIsCustomProvider(isCustom)
    form.resetFields()
    form.setFieldsValue({
      provider: isCustom ? CUSTOM_PROVIDER_SENTINEL : model.provider,
      customProviderId: isCustom ? model.provider : undefined,
      customProviderName: isCustom ? (model.config?.providerDisplayName ?? '') : undefined,
      name: model.name,
      displayName: model.displayName,
      enabled: model.enabled,
      capabilities: model.capabilities || [],
      quotaDaily: model.quotaLimit?.daily,
      quotaMonthly: model.quotaLimit?.monthly,
      quotaPerUser: model.quotaLimit?.perUser
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await modelsApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      const isCustom = values.provider === CUSTOM_PROVIDER_SENTINEL
      const actualProviderId = isCustom ? values.customProviderId : values.provider
      const config = isCustom
        ? { capabilities: values.capabilities || [], providerDisplayName: values.customProviderName }
        : { capabilities: values.capabilities || [] }

      if (editingModel) {
        // 编辑模式：只发送可编辑的字段（不含 apiKey/apiEndpoint）
        await modelsApi.update(editingModel.id, {
          providerId: actualProviderId,
          name: values.name,
          displayName: values.displayName,
          isEnabled: values.enabled,
          config,
          quota: {
            dailyLimit: values.quotaDaily,
            monthlyLimit: values.quotaMonthly,
            perUserLimit: values.quotaPerUser
          }
        })
        message.success('更新成功')
      } else {
        // 创建模式：发送所有字段
        await modelsApi.create({
          providerId: actualProviderId,
          name: values.name,
          displayName: values.displayName,
          apiKey: values.apiKey,
          apiEndpoint: values.baseUrl,
          config,
          quota: {
            dailyLimit: values.quotaDaily,
            monthlyLimit: values.quotaMonthly,
            perUserLimit: values.quotaPerUser
          }
        })
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const handleToggleEnabled = async (model: Model) => {
    try {
      await modelsApi.update(model.id, { isEnabled: !model.enabled })
      message.success(model.enabled ? '已禁用' : '已启用')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败')
    }
  }

  const handlePermissions = (modelId: string) => {
    setSelectedModelId(modelId)
    permissionForm.resetFields()
    setPermissionModalOpen(true)
  }

  const handlePermissionSubmit = async () => {
    try {
      const values = await permissionForm.validateFields()
      await modelsApi.updatePermissions(selectedModelId!, {
        departmentIds: values.departmentIds || [],
        roleIds: values.roleIds || []
      })
      message.success('权限更新成功')
      setPermissionModalOpen(false)
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const handlePricing = (model: Model) => {
    setSelectedModelId(model.id)
    setSelectedModelName(model.displayName)
    pricingForm.resetFields()
    pricingForm.setFieldsValue({ currency: 'CNY' })
    setPricingModalOpen(true)
  }

  const handlePricingSubmit = async () => {
    if (!selectedModelId) {
      return
    }
    try {
      const values = await pricingForm.validateFields()
      await modelsApi.setPricing(selectedModelId, {
        inputPerMillionTokens: values.inputPerMillionTokens,
        outputPerMillionTokens: values.outputPerMillionTokens,
        currency: values.currency,
        note: values.note || undefined
      })
      message.success('定价更新成功')
      setPricingModalOpen(false)
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '定价更新失败')
      }
    }
  }

  // setState 函数引用稳定，无需列入依赖
  const loadPricingHistory = useCallback(async (modelId: string, modelName: string) => {
    setSelectedModelId(modelId)
    setSelectedModelName(modelName)
    setPricingLoading(true)
    setPricingHistoryModalOpen(true)
    try {
      const response = await modelsApi.getPricingHistory(modelId)
      setPricingHistory(response.data.data)
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '加载定价历史失败')
      }
    } finally {
      setPricingLoading(false)
    }
  }, [])

  const columns: ColumnsType<Model> = [
    {
      title: '模型名称',
      dataIndex: 'displayName',
      key: 'displayName'
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string, record: Model) => {
        const displayName = record.config?.providerDisplayName || PROVIDER_DISPLAY_NAMES[provider] || provider
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProviderLogo providerId={provider} providerName={displayName} size={20} />
            <span>{displayName}</span>
          </div>
        )
      }
    },
    {
      title: '模型标识',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <code>{name}</code>
    },
    {
      title: '模型能力',
      dataIndex: 'capabilities',
      key: 'capabilities',
      render: (capabilities: string[]) => (
        <Space wrap size={[0, 4]}>
          {(capabilities || []).map((cap) => {
            const option = capabilityOptions.find((o) => o.value === cap)
            return (
              <Tag key={cap} color={option?.color || 'default'}>
                {option?.label || cap}
              </Tag>
            )
          })}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled, record) => <Switch checked={enabled} onChange={() => handleToggleEnabled(record)} />
    },
    {
      title: '配额限制',
      key: 'quota',
      render: (_, record) => {
        const limits = []
        if (record.quotaLimit?.daily) limits.push(`日: ${record.quotaLimit.daily}`)
        if (record.quotaLimit?.monthly) limits.push(`月: ${record.quotaLimit.monthly}`)
        if (record.quotaLimit?.perUser) limits.push(`用户: ${record.quotaLimit.perUser}`)
        return limits.length > 0 ? limits.join(' / ') : <Tag>无限制</Tag>
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {canSettings && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canSettings && (
            <Button type="link" icon={<DollarOutlined />} onClick={() => handlePricing(record)}>
              定价
            </Button>
          )}
          {canSettings && (
            <Button
              type="link"
              icon={<HistoryOutlined />}
              onClick={() => loadPricingHistory(record.id, record.displayName)}>
              历史
            </Button>
          )}
          {canSettings && (
            <Button type="link" onClick={() => handlePermissions(record.id)}>
              权限
            </Button>
          )}
          {canSettings && (
            <Popconfirm title="确定要删除这个模型吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          {canSettings && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加模型
            </Button>
          )}
          {canSettings && (
            <Button icon={<CloudDownloadOutlined />} onClick={() => setFetchModelsOpen(true)}>
              管理模型
            </Button>
          )}
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={models} loading={loading} pagination={false} />

      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        width={600}>
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select
              options={providerOptions}
              placeholder="请选择提供商"
              disabled={!!editingModel}
              onChange={(value: string) => {
                const isCustom = value === CUSTOM_PROVIDER_SENTINEL
                setIsCustomProvider(isCustom)
                if (!isCustom) {
                  form.setFieldsValue({ customProviderId: undefined, customProviderName: undefined })
                }
              }}
            />
          </Form.Item>
          {isCustomProvider && (
            <>
              <Form.Item
                name="customProviderId"
                label="供应商标识"
                rules={[
                  { required: true, message: '请输入供应商标识' },
                  { max: 50, message: '供应商标识不能超过 50 个字符' },
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve()
                      if (value === CUSTOM_PROVIDER_SENTINEL) {
                        return Promise.reject(new Error('该标识为系统保留关键字'))
                      }
                      if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
                        return Promise.reject(new Error('只能包含小写字母、数字、连字符和下划线，且以字母或数字开头'))
                      }
                      if (value in ENTERPRISE_PROVIDER_IDS) {
                        return Promise.reject(new Error('该标识与预设供应商冲突，请使用其他标识'))
                      }
                      return Promise.resolve()
                    }
                  }
                ]}
                tooltip="唯一标识符，例如: my-gateway（不可与预设供应商重复）">
                <Input placeholder="例如: my-gateway" />
              </Form.Item>
              {editingModel && isCustomProvider && (
                <div style={{ color: '#faad14', fontSize: 12, marginTop: -20, marginBottom: 16 }}>
                  注意：修改供应商标识后，客户端已缓存的模型信息可能需要重新同步
                </div>
              )}
              <Form.Item
                name="customProviderName"
                label="供应商显示名称"
                rules={[{ required: true, message: '请输入供应商显示名称' }]}>
                <Input placeholder="例如: 我的 API 网关" />
              </Form.Item>
            </>
          )}
          <Form.Item name="name" label="模型标识" rules={[{ required: true, message: '请输入模型标识' }]}>
            <Input placeholder="例如: gpt-4, claude-3-opus" disabled={!!editingModel} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="例如: GPT-4, Claude 3 Opus" />
          </Form.Item>
          {!editingModel && (
            <>
              <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
                <Input.Password placeholder="输入 API Key" />
              </Form.Item>
              <Form.Item
                name="baseUrl"
                label="Base URL"
                rules={[
                  ...(isCustomProvider ? [{ required: true, message: '自定义供应商必须提供 Base URL' }] : []),
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve()
                      try {
                        const url = new URL(value)
                        if (!['http:', 'https:'].includes(url.protocol)) {
                          return Promise.reject(new Error('仅支持 HTTP/HTTPS 协议'))
                        }
                        return Promise.resolve()
                      } catch {
                        return Promise.reject(new Error('请输入有效的 URL 地址'))
                      }
                    }
                  }
                ]}>
                <Input placeholder={isCustomProvider ? '必填，例如: https://my-api.com/v1' : '可选，自定义 API 地址'} />
              </Form.Item>
            </>
          )}
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="capabilities" label="模型能力标签" tooltip="选择此模型支持的能力，这些标签将在客户端显示">
            <Select
              mode="multiple"
              placeholder="选择模型能力"
              options={capabilityOptions.map((opt) => ({
                label: <Tag color={opt.color}>{opt.label}</Tag>,
                value: opt.value
              }))}
            />
          </Form.Item>
          <Form.Item label="配额限制">
            <Space>
              <Form.Item name="quotaDaily" noStyle>
                <InputNumber min={0} placeholder="日限额" style={{ width: 100 }} />
              </Form.Item>
              <span>次/日</span>
              <Form.Item name="quotaMonthly" noStyle>
                <InputNumber min={0} placeholder="月限额" style={{ width: 100 }} />
              </Form.Item>
              <span>次/月</span>
              <Form.Item name="quotaPerUser" noStyle>
                <InputNumber min={0} placeholder="用户限额" style={{ width: 100 }} />
              </Form.Item>
              <span>次/用户/日</span>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="模型权限设置"
        open={permissionModalOpen}
        onOk={handlePermissionSubmit}
        onCancel={() => setPermissionModalOpen(false)}
        destroyOnHidden>
        <Form form={permissionForm} layout="vertical">
          <Form.Item name="departmentIds" label="允许的部门">
            <Select
              mode="multiple"
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              placeholder="留空表示全部部门可用"
            />
          </Form.Item>
          <Form.Item name="roleIds" label="允许的角色">
            <Select
              mode="multiple"
              options={roles.map((r) => ({ label: r.name, value: r.id }))}
              placeholder="留空表示全部角色可用"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`设置定价 — ${selectedModelName}`}
        open={pricingModalOpen}
        onOk={handlePricingSubmit}
        onCancel={() => setPricingModalOpen(false)}
        destroyOnHidden
        width={500}>
        <Form form={pricingForm} layout="vertical">
          <Form.Item name="currency" label="币种" rules={[{ required: true, message: '请选择币种' }]}>
            <Select
              options={[
                { label: 'CNY (¥)', value: 'CNY' },
                { label: 'USD ($)', value: 'USD' }
              ]}
            />
          </Form.Item>
          <Form.Item
            name="inputPerMillionTokens"
            label="输入价格（每百万 Tokens）"
            rules={[{ required: true, message: '请输入输入价格' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="例如: 15.00" />
          </Form.Item>
          <Form.Item
            name="outputPerMillionTokens"
            label="输出价格（每百万 Tokens）"
            rules={[{ required: true, message: '请输入输出价格' }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="例如: 60.00" />
          </Form.Item>
          <Form.Item name="note" label="变更备注">
            <Input placeholder="例如: GPT-4o 降价 50%" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`定价历史 — ${selectedModelName}`}
        open={pricingHistoryModalOpen}
        onCancel={() => setPricingHistoryModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={600}>
        {pricingLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : pricingHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--cs-text-3)' }}>暂无定价记录</div>
        ) : (
          <Timeline
            items={pricingHistory.map((item) => ({
              color: item.effectiveTo ? 'gray' : 'green',
              children: (
                <div key={item.id}>
                  <div style={{ marginBottom: 4 }}>
                    <Tag color={item.effectiveTo ? 'default' : 'green'}>{item.effectiveTo ? '已失效' : '当前生效'}</Tag>
                    <Tag>{item.currency}</Tag>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    输入: <strong>{item.inputPerMillionTokens}</strong> / 百万 tokens
                    <Divider type="vertical" />
                    输出: <strong>{item.outputPerMillionTokens}</strong> / 百万 tokens
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--cs-text-3)', marginTop: 4 }}>
                    生效时间: {dayjs(item.effectiveFrom).format('YYYY-MM-DD HH:mm')}
                    {item.effectiveTo && ` → ${dayjs(item.effectiveTo).format('YYYY-MM-DD HH:mm')}`}
                  </div>
                  {item.createdByName && (
                    <div style={{ fontSize: 12, color: 'var(--cs-text-3)' }}>操作人: {item.createdByName}</div>
                  )}
                  {item.note && <div style={{ fontSize: 12, color: 'var(--cs-text-3)' }}>备注: {item.note}</div>}
                </div>
              )
            }))}
          />
        )}
      </Modal>

      <FetchModelsPopup open={fetchModelsOpen} onClose={() => setFetchModelsOpen(false)} onSuccess={loadData} />
    </div>
  )
}
