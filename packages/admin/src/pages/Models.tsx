import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { getProviderOptions, PROVIDER_DISPLAY_NAMES } from '@cherry-studio/enterprise-shared'
import { Button, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'

import { departmentsApi, modelsApi, rolesApi } from '../services/api'
import { useAuthStore } from '../store/auth'

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
  createdAt: string
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
 * 与客户端 SystemProviderId 完全对齐
 */
const providerOptions = getProviderOptions()

export default function Models() {
  const [loading, setLoading] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [permissionForm] = Form.useForm()
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
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (model: Model) => {
    setEditingModel(model)
    form.setFieldsValue({
      provider: model.provider,
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
      const data = {
        providerId: values.provider,
        name: values.name,
        displayName: values.displayName,
        apiKey: values.apiKey,
        apiEndpoint: values.baseUrl,
        config: {
          capabilities: values.capabilities || []
        },
        quota: {
          dailyLimit: values.quotaDaily,
          monthlyLimit: values.quotaMonthly,
          perUserLimit: values.quotaPerUser
        }
      }

      if (editingModel) {
        await modelsApi.update(editingModel.id, data)
        message.success('更新成功')
      } else {
        await modelsApi.create(data)
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
      await modelsApi.update(model.id, { enabled: !model.enabled })
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
      render: (provider) => PROVIDER_DISPLAY_NAMES[provider] || provider
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
        {canSettings && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加模型
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={models} loading={loading} pagination={false} />

      <Modal
        title={editingModel ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select options={providerOptions} placeholder="请选择提供商" />
          </Form.Item>
          <Form.Item name="name" label="模型标识" rules={[{ required: true, message: '请输入模型标识' }]}>
            <Input placeholder="例如: gpt-4, claude-3-opus" />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="例如: GPT-4, Claude 3 Opus" />
          </Form.Item>
          {!editingModel && (
            <>
              <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
                <Input.Password placeholder="输入 API Key" />
              </Form.Item>
              <Form.Item name="baseUrl" label="Base URL">
                <Input placeholder="可选，自定义 API 地址" />
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
        destroyOnClose>
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
    </div>
  )
}
