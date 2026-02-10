import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Tag, Tooltip } from 'antd'
import { type CSSProperties, type FC, memo } from 'react'

interface PresetTag {
  id: string
  name: string
}

interface PresetItem {
  id: string
  name: string
  emoji?: string
  description?: string
  prompt: string
  isEnabled: boolean
  tags?: PresetTag[]
}

interface PresetCardProps {
  preset: PresetItem
  canWrite: boolean
  canAdmin: boolean
  onEdit: (preset: PresetItem) => void
  onDelete: (id: string) => void
  onToggleEnabled: (preset: PresetItem) => void
}

const cardStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 12,
  border: '1px solid var(--cs-border-subtle)',
  padding: 16,
  overflow: 'hidden',
  cursor: 'default',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  height: 160,
  display: 'flex',
  flexDirection: 'column'
}

const backgroundStyle = (emoji?: string): CSSProperties => ({
  position: 'absolute',
  top: 0,
  right: -50,
  fontSize: 200,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  opacity: 0.1,
  filter: 'blur(20px)',
  borderRadius: 99,
  overflow: 'hidden',
  content: emoji || ''
})

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  justifyContent: 'space-between',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 1
}

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.2,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 1,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-all'
}

const tagsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 4
}

const emojiStyle: CSSProperties = {
  width: 45,
  height: 45,
  borderRadius: 10,
  fontSize: 26,
  flexShrink: 0,
  backgroundColor: 'var(--cs-bg-2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const promptPreviewStyle: CSSProperties = {
  flex: 1,
  fontSize: 12,
  lineHeight: 1.4,
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  color: 'var(--cs-text-3)',
  marginTop: 12,
  backgroundColor: 'var(--cs-bg-2)',
  padding: 8,
  borderRadius: 10,
  position: 'relative',
  zIndex: 1
}

const actionsStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  gap: 4,
  opacity: 0,
  transition: 'opacity 0.2s ease',
  zIndex: 2
}

const PresetCard: FC<PresetCardProps> = ({ preset, canWrite, canAdmin, onEdit, onDelete, onToggleEnabled }) => {
  const promptText = (preset.description || preset.prompt).substring(0, 200).replace(/\\n/g, '')

  return (
    <div
      style={cardStyle}
      className="preset-card"
      onMouseEnter={(e) => {
        const target = e.currentTarget
        target.style.boxShadow = '0 0 20px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.3)'
        target.style.transform = 'translateY(-2px)'
        const actions = target.querySelector('.preset-card-actions') as HTMLElement | null
        if (actions) {
          actions.style.opacity = '1'
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget
        target.style.boxShadow = 'none'
        target.style.transform = 'translateY(0)'
        const actions = target.querySelector('.preset-card-actions') as HTMLElement | null
        if (actions) {
          actions.style.opacity = '0'
        }
      }}>
      {/* Emoji background */}
      <div style={backgroundStyle(preset.emoji)}>{preset.emoji}</div>

      {/* Action buttons (hover) */}
      {(canWrite || canAdmin) && (
        <div className="preset-card-actions" style={actionsStyle}>
          {canWrite && (
            <Tooltip title="编辑">
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(preset)} />
            </Tooltip>
          )}
          {canWrite && (
            <Tooltip title={preset.isEnabled ? '禁用' : '启用'}>
              <Button
                size="small"
                type="text"
                icon={preset.isEnabled ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                onClick={() => onToggleEnabled(preset)}
              />
            </Tooltip>
          )}
          {canAdmin && (
            <Popconfirm
              title="确定要删除这个预设吗？"
              onConfirm={() => onDelete(preset.id)}
              okText="确定"
              cancelText="取消">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </div>
      )}

      {/* Header */}
      <div style={headerStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={titleStyle}>
            {!preset.isEnabled && (
              <Tag color="default" style={{ marginRight: 4, fontSize: 11 }}>
                已禁用
              </Tag>
            )}
            {preset.name}
          </div>
          <div style={tagsRowStyle}>
            {(preset.tags || []).map((tag) => (
              <Tag key={tag.id} color="blue" style={{ margin: 0, fontSize: 11 }}>
                {tag.name}
              </Tag>
            ))}
          </div>
        </div>
        {preset.emoji && <div style={emojiStyle}>{preset.emoji}</div>}
      </div>

      {/* Prompt preview */}
      <div style={promptPreviewStyle}>{promptText}</div>
    </div>
  )
}

export default memo(PresetCard)
