import { LoadingOutlined, RollbackOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, Form, Input, message, Modal, Select, Switch } from 'antd'
import type { FC } from 'react'
import { useEffect, useState } from 'react'

import { assistantPresetsApi } from '../../services/api'

const { TextArea } = Input

interface PresetTag {
  id: string
  name: string
  locale: string
  order: number
}

interface PresetItem {
  id: string
  name: string
  emoji?: string
  description?: string
  prompt: string
  locale: string
  isEnabled: boolean
  order: number
  tags?: PresetTag[]
}

interface PresetFormModalProps {
  open: boolean
  preset: PresetItem | null
  locale: string
  tags: PresetTag[]
  onClose: () => void
  onSuccess: () => void
}

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]

const PresetFormModal: FC<PresetFormModalProps> = ({ open, preset, locale, tags, onClose, onSuccess }) => {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [originalPrompt, setOriginalPrompt] = useState('')

  const isEditing = Boolean(preset)

  useEffect(() => {
    if (open) {
      if (preset) {
        form.setFieldsValue({
          name: preset.name,
          emoji: preset.emoji || '',
          description: preset.description || '',
          prompt: preset.prompt,
          locale: preset.locale,
          isEnabled: preset.isEnabled,
          order: preset.order,
          tagIds: (preset.tags || []).map((t) => t.id)
        })
      } else {
        form.resetFields()
        form.setFieldsValue({
          locale,
          isEnabled: true,
          order: 0
        })
      }
      setShowUndo(false)
      setOriginalPrompt('')
    }
  }, [open, preset, locale, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const data = {
        name: values.name,
        emoji: values.emoji || undefined,
        description: values.description || undefined,
        prompt: values.prompt,
        locale: values.locale,
        isEnabled: values.isEnabled,
        order: values.order || 0,
        tagIds: values.tagIds || []
      }

      if (isEditing && preset) {
        await assistantPresetsApi.update(preset.id, data)
        message.success('更新成功')
      } else {
        await assistantPresetsApi.create(data)
        message.success('创建成功')
      }
      onSuccess()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleGeneratePrompt = async () => {
    const name = form.getFieldValue('name')
    const currentPrompt = form.getFieldValue('prompt')
    const content = currentPrompt || name

    if (!content) {
      message.warning('请先输入名称或提示词内容')
      return
    }

    setGenerating(true)
    setShowUndo(false)

    try {
      const response = await assistantPresetsApi.generatePrompt({ content })
      const generatedPrompt = response.data.data?.prompt
      if (generatedPrompt) {
        setOriginalPrompt(currentPrompt || '')
        form.setFieldsValue({ prompt: generatedPrompt })
        setShowUndo(true)
      }
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || 'AI 生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleUndo = () => {
    form.setFieldsValue({ prompt: originalPrompt })
    setShowUndo(false)
  }

  const tagOptions = tags.map((tag) => ({
    label: tag.name,
    value: tag.id
  }))

  return (
    <Modal
      title={isEditing ? '编辑提示词助手' : '新增提示词助手'}
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={submitting}
      width={640}
      destroyOnClose
      maskClosable={false}>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="emoji" label="Emoji">
          <Input placeholder="输入 emoji 表情，如 😀 🎯 💡" maxLength={50} style={{ width: 200 }} />
        </Form.Item>

        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入助手名称' }]}>
          <Input placeholder="请输入助手名称" maxLength={200} />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <TextArea placeholder="简短描述助手的功能" rows={2} maxLength={500} />
        </Form.Item>

        <div style={{ position: 'relative' }}>
          <Form.Item name="prompt" label="系统提示词" rules={[{ required: true, message: '请输入系统提示词' }]}>
            <TextArea placeholder="请输入系统提示词" rows={10} />
          </Form.Item>
          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 4 }}>
            {showUndo && (
              <Button size="small" icon={<RollbackOutlined />} onClick={handleUndo}>
                撤回
              </Button>
            )}
            <Button
              size="small"
              icon={generating ? <LoadingOutlined /> : <ThunderboltOutlined />}
              onClick={handleGeneratePrompt}
              disabled={generating}>
              AI 生成
            </Button>
          </div>
        </div>

        <Form.Item name="tagIds" label="所属标签">
          <Select
            mode="multiple"
            allowClear
            placeholder="选择所属标签"
            options={tagOptions}
            filterOption={(input, option) =>
              String(option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="locale" label="语言" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={localeOptions} placeholder="请选择语言" />
          </Form.Item>

          <Form.Item name="order" label="排序权重" style={{ flex: 1 }}>
            <Input type="number" min={0} placeholder="数字越小越靠前" />
          </Form.Item>

          <Form.Item name="isEnabled" label="启用状态" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default PresetFormModal
