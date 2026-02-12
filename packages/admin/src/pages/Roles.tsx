import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Checkbox, Form, Input, message, Modal, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'

import { rolesApi } from '../services/api'
import { useAuthStore } from '../store/auth'

interface Role {
  id: string
  name: string
  description?: string
  permissions: Record<string, string[]>
  isSystem: boolean
  createdAt: string
}

const permissionCategories = [
  {
    key: 'models',
    label: '模型管理',
    options: [
      { value: 'read', label: '查看' },
      { value: 'use', label: '使用' }
    ]
  },
  {
    key: 'knowledgeBases',
    label: '知识库',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  },
  {
    key: 'users',
    label: '用户管理',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  },
  {
    key: 'statistics',
    label: '数据统计',
    options: [
      { value: 'read', label: '查看' },
      { value: 'export', label: '导出' }
    ]
  },
  {
    key: 'system',
    label: '系统设置',
    options: [
      { value: 'backup', label: '备份' },
      { value: 'restore', label: '恢复' },
      { value: 'settings', label: '设置' }
    ]
  },
  {
    key: 'assistantPresets',
    label: '助手预设',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  },
  {
    key: 'learningCenter',
    label: '学习中心',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'admin', label: '管理' }
    ]
  },
  {
    key: 'presentations',
    label: '演示文稿',
    options: [
      { value: 'read', label: '查看' },
      { value: 'write', label: '编辑' },
      { value: 'export', label: '导出' },
      { value: 'admin', label: '管理' }
    ]
  }
]

export default function Roles() {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [form] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canAdmin = hasPermission('users', 'admin')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await rolesApi.list()
      setRoles(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载角色列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingRole(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (role: Role) => {
    setEditingRole(role)
    form.setFieldsValue({
      name: role.name,
      description: role.description,
      ...Object.fromEntries(Object.entries(role.permissions).map(([key, value]) => [`permissions_${key}`, value]))
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await rolesApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const permissions: Record<string, string[]> = {}

      permissionCategories.forEach((cat) => {
        permissions[cat.key] = values[`permissions_${cat.key}`] || []
      })

      const data = {
        name: values.name,
        description: values.description,
        permissions
      }

      if (editingRole) {
        await rolesApi.update(editingRole.id, data)
        message.success('更新成功')
      } else {
        await rolesApi.create(data)
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

  const columns: ColumnsType<Role> = [
    {
      title: '角色名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          {name}
          {record.isSystem && <Tag color="blue">系统</Tag>}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_, record) => {
        const count = Object.values(record.permissions).flat().length
        return <span>{count} 项权限</span>
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {canAdmin && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} disabled={record.isSystem}>
              编辑
            </Button>
          )}
          {canAdmin && (
            <Popconfirm
              title="确定要删除这个角色吗？"
              onConfirm={() => handleDelete(record.id)}
              disabled={record.isSystem}>
              <Button type="link" danger icon={<DeleteOutlined />} disabled={record.isSystem}>
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
        {canAdmin && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加角色
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={roles} loading={loading} pagination={false} />

      <Modal
        title={editingRole ? '编辑角色' : '添加角色'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>

          {permissionCategories.map((cat) => (
            <Form.Item key={cat.key} name={`permissions_${cat.key}`} label={cat.label}>
              <Checkbox.Group options={cat.options} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}
