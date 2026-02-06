import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import type { TreeDataNode } from 'antd'
import { Button, Card, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Space, Tree } from 'antd'
import { useEffect, useState } from 'react'

import { departmentsApi } from '../services/api'

interface Department {
  id: string
  name: string
  order: number
  children?: Department[]
}

export default function Departments() {
  const [loading, setLoading] = useState(false)
  const [treeData, setTreeData] = useState<TreeDataNode[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [parentId, setParentId] = useState<string | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await departmentsApi.tree()
      setTreeData(transformToTreeData(response.data.data))
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载部门列表失败')
    } finally {
      setLoading(false)
    }
  }

  const transformToTreeData = (departments: Department[]): TreeDataNode[] => {
    return departments.map((dept) => ({
      key: dept.id,
      title: dept.name,
      children: dept.children ? transformToTreeData(dept.children) : []
    }))
  }

  const handleAdd = (parentId?: string) => {
    setEditingDept(null)
    setParentId(parentId || null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = async (id: string) => {
    try {
      const response = await departmentsApi.get(id)
      const dept = response.data.data
      setEditingDept(dept)
      setParentId(dept.parentId)
      form.setFieldsValue({
        name: dept.name,
        order: dept.order
      })
      setModalOpen(true)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载部门信息失败')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await departmentsApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingDept) {
        await departmentsApi.update(editingDept.id, values)
        message.success('更新成功')
      } else {
        await departmentsApi.create({ ...values, parentId })
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

  const titleRender = (node: TreeDataNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 200 }}>
      <span>{node.title as string}</span>
      <Space size="small">
        <Button type="link" size="small" onClick={() => handleAdd(node.key as string)}>
          添加子部门
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(node.key as string)} />
        <Popconfirm title="确定要删除这个部门吗？" onConfirm={() => handleDelete(node.key as string)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd()}>
          添加根部门
        </Button>
      </div>

      <Card loading={loading}>
        {treeData.length > 0 ? (
          <Tree showLine defaultExpandAll treeData={treeData} titleRender={titleRender} />
        ) : (
          <Empty description="暂无部门数据" />
        )}
      </Card>

      <Modal
        title={editingDept ? '编辑部门' : '添加部门'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="order" label="排序" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
