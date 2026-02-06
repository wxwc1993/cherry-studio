import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, message, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

import { departmentsApi, rolesApi, usersApi } from '../services/api'
import { useAuthStore } from '../store/auth'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  status: string
  department: { id: string; name: string }
  role: { id: string; name: string }
  lastLoginAt?: string
  createdAt: string
}

interface Department {
  id: string
  name: string
}

interface Role {
  id: string
  name: string
}

export default function Users() {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 })
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canWrite = hasPermission('users', 'write')
  const canAdmin = hasPermission('users', 'admin')

  useEffect(() => {
    loadData()
    loadDepartmentsAndRoles()
  }, [])

  const loadData = async (page = 1, pageSize = 20) => {
    try {
      setLoading(true)
      const response = await usersApi.list({ page, pageSize })
      setUsers(response.data.data)
      setPagination({
        current: response.data.pagination.page,
        pageSize: response.data.pagination.pageSize,
        total: response.data.pagination.total
      })
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载用户列表失败')
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
    setEditingUser(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      departmentId: user.department.id,
      roleId: user.role.id,
      status: user.status
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await usersApi.delete(id)
      message.success('删除成功')
      loadData(pagination.current, pagination.pageSize)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingUser) {
        await usersApi.update(editingUser.id, values)
        message.success('更新成功')
      } else {
        await usersApi.create(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData(pagination.current, pagination.pageSize)
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const columns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: '部门',
      dataIndex: ['department', 'name'],
      key: 'department'
    },
    {
      title: '角色',
      dataIndex: ['role', 'name'],
      key: 'role'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors: Record<string, string> = {
          active: 'green',
          inactive: 'default',
          suspended: 'red'
        }
        const labels: Record<string, string> = {
          active: '正常',
          inactive: '未激活',
          suspended: '已停用'
        }
        return <Tag color={colors[status]}>{labels[status]}</Tag>
      }
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {canWrite && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canAdmin && (
            <Popconfirm title="确定要删除这个用户吗？" onConfirm={() => handleDelete(record.id)}>
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
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加用户
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={(p) => loadData(p.current, p.pageSize)}
      />

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}>
            <Input />
          </Form.Item>
          <Form.Item name="departmentId" label="部门" rules={[{ required: true, message: '请选择部门' }]}>
            <Select options={departments.map((d) => ({ label: d.name, value: d.id }))} placeholder="请选择部门" />
          </Form.Item>
          <Form.Item name="roleId" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roles.map((r) => ({ label: r.name, value: r.id }))} placeholder="请选择角色" />
          </Form.Item>
          {editingUser && (
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { label: '正常', value: 'active' },
                  { label: '未激活', value: 'inactive' },
                  { label: '已停用', value: 'suspended' }
                ]}
              />
            </Form.Item>
          )}
          {!editingUser && (
            <Form.Item name="feishuUserId" label="飞书用户 ID">
              <Input placeholder="可选，用于飞书登录绑定" />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
