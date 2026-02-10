import { AppstoreOutlined, DatabaseOutlined, PlusOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import { Badge, Button, Empty, Input, message, Pagination, Popconfirm, Select, Space } from 'antd'
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'

import { assistantPresetsApi } from '../../services/api'
import { useAuthStore } from '../../store/auth'
import PresetCard from './PresetCard'
import PresetFormModal from './PresetFormModal'
import TagManager from './TagManager'

interface PresetTag {
  id: string
  name: string
  locale: string
  order: number
  presetCount?: number
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

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]

// ============ Styles ============

const containerStyle: CSSProperties = {
  display: 'flex',
  height: 'calc(100vh - 64px - 48px - 48px)',
  margin: -24,
  overflow: 'hidden'
}

const sidebarStyle: CSSProperties = {
  minWidth: 200,
  maxWidth: 240,
  borderRight: '1px solid var(--cs-border)',
  background: 'var(--cs-bg-1)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}

const sidebarHeaderStyle: CSSProperties = {
  padding: '16px 12px 8px',
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--cs-text-1)',
  fontFamily: 'var(--cs-font-heading)'
}

const sidebarListStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 8px'
}

const sidebarItemStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  margin: '2px 0',
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: active ? 'rgba(99,102,241,0.15)' : 'transparent',
  color: active ? 'var(--cs-primary-hover)' : 'var(--cs-text-1)',
  fontWeight: active ? 500 : 400,
  transition: 'background-color 0.2s ease',
  fontSize: 14
})

const sidebarFooterStyle: CSSProperties = {
  padding: '8px 12px',
  borderTop: '1px solid var(--cs-border)',
  display: 'flex',
  gap: 8
}

const mainContentStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}

const listHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid var(--cs-border)',
  flexShrink: 0
}

const listTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 8
}

const gridStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gridAutoRows: 160,
  gap: 16,
  alignContent: 'start'
}

const emptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
}

const paginationStyle: CSSProperties = {
  padding: '12px 16px',
  display: 'flex',
  justifyContent: 'flex-end',
  borderTop: '1px solid var(--cs-border)',
  flexShrink: 0
}

export default function AssistantPresets() {
  const { hasPermission } = useAuthStore()
  const canWrite = hasPermission('assistantPresets', 'write')
  const canAdmin = hasPermission('assistantPresets', 'admin')

  // State
  const [tags, setTags] = useState<PresetTag[]>([])
  const [presets, setPresets] = useState<PresetItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTagId, setActiveTagId] = useState<string | undefined>(undefined)
  const [locale, setLocale] = useState('zh-CN')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Modal state
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [presetFormOpen, setPresetFormOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PresetItem | null>(null)

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const response = await assistantPresetsApi.listTags({ locale })
      setTags(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载标签失败')
    }
  }, [locale])

  // Load presets
  const loadPresets = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = {
        page,
        pageSize,
        locale
      }
      if (activeTagId) {
        params.tagId = activeTagId
      }
      if (search.trim()) {
        params.search = search.trim()
      }
      const response = await assistantPresetsApi.list(params)
      setPresets(response.data.data)
      setTotal(response.data.pagination?.total || 0)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载预设列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, locale, activeTagId, search])

  useEffect(() => {
    loadTags()
  }, [loadTags])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  // Handlers
  const handleTagClick = (tagId?: string) => {
    setActiveTagId(tagId)
    setPage(1)
  }

  const handleLocaleChange = (value: string) => {
    setLocale(value)
    setActiveTagId(undefined)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleAddPreset = () => {
    setEditingPreset(null)
    setPresetFormOpen(true)
  }

  const handleEditPreset = (preset: PresetItem) => {
    setEditingPreset(preset)
    setPresetFormOpen(true)
  }

  const handleDeletePreset = async (id: string) => {
    try {
      await assistantPresetsApi.delete(id)
      message.success('删除成功')
      loadPresets()
      loadTags()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleToggleEnabled = async (preset: PresetItem) => {
    try {
      await assistantPresetsApi.update(preset.id, { isEnabled: !preset.isEnabled })
      message.success(preset.isEnabled ? '已禁用' : '已启用')
      loadPresets()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '操作失败')
    }
  }

  const handlePresetFormSuccess = () => {
    setPresetFormOpen(false)
    setEditingPreset(null)
    loadPresets()
    loadTags()
  }

  const handleSeed = async () => {
    try {
      const response = await assistantPresetsApi.seed()
      const stats = response.data.data
      message.success(`导入完成: ${stats?.tagsCount || 0} 个标签, ${stats?.presetsCount || 0} 个预设`)
      loadTags()
      loadPresets()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '导入失败')
    }
  }

  const activeTagName = useMemo(() => {
    if (!activeTagId) return '全部'
    const tag = tags.find((t) => t.id === activeTagId)
    return tag?.name || '全部'
  }, [activeTagId, tags])

  return (
    <div style={containerStyle}>
      {/* Left sidebar - Tag list */}
      <div style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>分类标签</div>
        <div style={sidebarListStyle}>
          {/* All item */}
          <div
            style={sidebarItemStyle(!activeTagId)}
            onClick={() => handleTagClick(undefined)}
            onMouseEnter={(e) => {
              if (!activeTagId) return
              e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'
            }}
            onMouseLeave={(e) => {
              if (!activeTagId) return
              e.currentTarget.style.backgroundColor = 'transparent'
            }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AppstoreOutlined />
              全部
            </span>
            <Badge
              count={total}
              overflowCount={999}
              style={{ backgroundColor: 'var(--cs-bg-3)', color: 'var(--cs-text-2)' }}
            />
          </div>

          {/* Tag items */}
          {tags.map((tag) => (
            <div
              key={tag.id}
              style={sidebarItemStyle(activeTagId === tag.id)}
              onClick={() => handleTagClick(tag.id)}
              onMouseEnter={(e) => {
                if (activeTagId === tag.id) return
                e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.08)'
              }}
              onMouseLeave={(e) => {
                if (activeTagId === tag.id) return
                e.currentTarget.style.backgroundColor = 'transparent'
              }}>
              <span>{tag.name}</span>
              <Badge
                count={tag.presetCount || 0}
                overflowCount={999}
                style={{
                  backgroundColor: activeTagId === tag.id ? 'var(--cs-primary)' : 'var(--cs-bg-3)',
                  color: activeTagId === tag.id ? '#fff' : 'var(--cs-text-2)'
                }}
              />
            </div>
          ))}
        </div>

        {/* Sidebar footer */}
        {canWrite && (
          <div style={sidebarFooterStyle}>
            <Button size="small" icon={<SettingOutlined />} onClick={() => setTagManagerOpen(true)} style={{ flex: 1 }}>
              管理标签
            </Button>
          </div>
        )}
      </div>

      {/* Right content - Preset grid */}
      <div style={mainContentStyle}>
        {/* List header */}
        <div style={listHeaderStyle}>
          <div style={listTitleStyle}>
            <span>{activeTagName}</span>
            <Badge count={total} overflowCount={999} style={{ backgroundColor: 'var(--cs-primary)' }} />
          </div>
          <Space>
            <Input.Search
              placeholder="搜索预设名称"
              allowClear
              onSearch={handleSearch}
              style={{ width: 200 }}
              prefix={<SearchOutlined />}
            />
            <Select options={localeOptions} value={locale} onChange={handleLocaleChange} style={{ width: 100 }} />
            {canAdmin && (
              <Popconfirm
                title="确定要导入初始数据吗？已有数据不会重复导入。"
                onConfirm={handleSeed}
                okText="确定"
                cancelText="取消">
                <Button icon={<DatabaseOutlined />}>导入初始数据</Button>
              </Popconfirm>
            )}
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPreset}>
                新增预设
              </Button>
            )}
          </Space>
        </div>

        {/* Preset grid */}
        {loading ? (
          <div style={emptyStyle}>
            <Empty description="加载中..." />
          </div>
        ) : presets.length > 0 ? (
          <div style={gridStyle}>
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                canWrite={canWrite}
                canAdmin={canAdmin}
                onEdit={handleEditPreset}
                onDelete={handleDeletePreset}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </div>
        ) : (
          <div style={emptyStyle}>
            <Empty description="暂无预设数据" />
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div style={paginationStyle}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* Tag manager modal */}
      <TagManager
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
        canWrite={canWrite}
        canAdmin={canAdmin}
        onTagsChanged={() => {
          loadTags()
          loadPresets()
        }}
      />

      {/* Preset form modal */}
      <PresetFormModal
        open={presetFormOpen}
        preset={editingPreset}
        locale={locale}
        tags={tags}
        onClose={() => {
          setPresetFormOpen(false)
          setEditingPreset(null)
        }}
        onSuccess={handlePresetFormSuccess}
      />
    </div>
  )
}
