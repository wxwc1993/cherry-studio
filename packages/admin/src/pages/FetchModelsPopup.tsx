/**
 * 远程获取模型列表弹窗
 *
 * 两步流程：
 * 1. 配置供应商（选择供应商、输入 API Key、Endpoint）
 * 2. 选择模型（搜索、筛选、编辑能力标签、批量添加）
 */

import { CloudDownloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  CUSTOM_PROVIDER_SENTINEL,
  ENTERPRISE_PROVIDER_IDS,
  getProviderDefaultEndpoint,
  getProviderOptions,
  PROVIDER_DEFAULT_ENDPOINTS,
  type RemoteModel
} from '@cherry-studio/enterprise-shared'
import { Button, Checkbox, Empty, Input, message, Modal, Select, Space, Spin, Steps, Tag, Tooltip } from 'antd'
import { useCallback, useMemo, useState } from 'react'

import ProviderLogo from '../components/ProviderLogo'
import { modelsApi } from '../services/api'

/** 能力标签选项 */
const CAPABILITY_OPTIONS = [
  { label: '视觉理解', value: 'vision', color: 'green' },
  { label: '深度推理', value: 'reasoning', color: 'blue' },
  { label: '文本嵌入', value: 'embedding', color: 'purple' },
  { label: '函数调用', value: 'function_calling', color: 'orange' },
  { label: '网络搜索', value: 'web_search', color: 'cyan' },
  { label: '重排序', value: 'rerank', color: 'magenta' },
  { label: '免费', value: 'free', color: 'gold' }
] as const

/** 筛选 Tab 选项 */
const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'vision', label: '视觉' },
  { key: 'reasoning', label: '推理' },
  { key: 'embedding', label: '嵌入' },
  { key: 'function_calling', label: '函数调用' },
  { key: 'web_search', label: '搜索' },
  { key: 'free', label: '免费' }
] as const

/** 可选择的模型（带 UI 状态） */
interface SelectableModel extends RemoteModel {
  readonly selected: boolean
  readonly editedCapabilities: string[]
}

interface FetchModelsPopupProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSuccess: () => void
}

/**
 * 构建供应商选项列表（带图标）
 */
const providerOptions = getProviderOptions().map((opt) => ({
  ...opt,
  searchLabel: opt.label,
  label: (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <ProviderLogo providerId={opt.value} providerName={String(opt.label)} size={18} />
      <span>{opt.label}</span>
    </div>
  )
}))

/**
 * 判断供应商是否支持自动获取（有默认端点配置）
 */
function isProviderSupported(providerId: string): boolean {
  return (PROVIDER_DEFAULT_ENDPOINTS[providerId] ?? '') !== ''
}

/**
 * 校验自定义供应商标识
 */
function validateCustomProviderId(value: string): string {
  if (!value) return '请输入供应商标识'
  if (value === CUSTOM_PROVIDER_SENTINEL) return '该标识为系统保留关键字'
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    return '只能包含小写字母、数字、连字符和下划线，且以字母或数字开头'
  }
  if (value.length > 50) return '供应商标识不能超过 50 个字符'
  if (value in ENTERPRISE_PROVIDER_IDS) return '该标识与预设供应商冲突，请使用其他标识'
  return ''
}

export default function FetchModelsPopup({ open, onClose, onSuccess }: FetchModelsPopupProps) {
  // Step 控制
  const [currentStep, setCurrentStep] = useState(0)

  // Step 1: 配置
  const [providerId, setProviderId] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)

  // 自定义供应商
  const [isCustomProvider, setIsCustomProvider] = useState(false)
  const [customProviderId, setCustomProviderId] = useState('')
  const [customProviderName, setCustomProviderName] = useState('')
  const [customProviderIdError, setCustomProviderIdError] = useState('')

  // Step 2: 模型列表
  const [models, setModels] = useState<readonly SelectableModel[]>([])
  const [searchText, setSearchText] = useState('')
  const [filterTab, setFilterTab] = useState<string>('all')
  const [batchLoading, setBatchLoading] = useState(false)

  /**
   * 重置全部状态
   */
  const resetState = useCallback(() => {
    setCurrentStep(0)
    setProviderId('')
    setApiKey('')
    setApiEndpoint('')
    setFetchLoading(false)
    setIsCustomProvider(false)
    setCustomProviderId('')
    setCustomProviderName('')
    setCustomProviderIdError('')
    setModels([])
    setSearchText('')
    setFilterTab('all')
    setBatchLoading(false)
  }, [])

  /**
   * 关闭弹窗
   */
  const handleClose = useCallback(() => {
    resetState()
    onClose()
  }, [resetState, onClose])

  /**
   * 供应商变更时自动填充端点
   */
  const handleProviderChange = useCallback((value: string) => {
    setProviderId(value)
    const isCustom = value === CUSTOM_PROVIDER_SENTINEL
    setIsCustomProvider(isCustom)
    if (isCustom) {
      setApiEndpoint('')
    } else {
      setCustomProviderId('')
      setCustomProviderName('')
      setCustomProviderIdError('')
      const defaultEndpoint = getProviderDefaultEndpoint(value)
      setApiEndpoint(defaultEndpoint)
    }
  }, [])

  /**
   * Step 1: 获取模型列表
   */
  const handleFetchModels = useCallback(async () => {
    const actualProviderId = isCustomProvider ? customProviderId : providerId

    if (!actualProviderId || !apiKey) {
      message.warning('请选择供应商并输入 API Key')
      return
    }
    if (isCustomProvider) {
      const error = validateCustomProviderId(customProviderId)
      if (error) {
        setCustomProviderIdError(error)
        return
      }
      if (!customProviderName.trim()) {
        message.warning('请输入供应商显示名称')
        return
      }
    }

    setFetchLoading(true)
    try {
      const response = await modelsApi.fetchRemoteModels({
        providerId: actualProviderId,
        apiKey,
        apiEndpoint: apiEndpoint || undefined
      })
      const result = response.data.data
      const remoteModels: readonly SelectableModel[] = (result.models || []).map(
        (m: RemoteModel): SelectableModel => ({
          ...m,
          selected: false,
          editedCapabilities: [...m.capabilities]
        })
      )
      setModels(remoteModels)
      setCurrentStep(1)

      if (remoteModels.length === 0) {
        message.info('未获取到模型列表，该供应商可能不支持自动获取')
      }
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '获取模型列表失败，请检查 API Key 和端点配置')
    } finally {
      setFetchLoading(false)
    }
  }, [providerId, apiKey, apiEndpoint, isCustomProvider, customProviderId, customProviderName])

  /**
   * 切换模型选中状态
   */
  const toggleModelSelection = useCallback((modelId: string) => {
    setModels((prev) => prev.map((m) => (m.id === modelId && !m.isAdded ? { ...m, selected: !m.selected } : m)))
  }, [])

  /**
   * 全选/取消全选（仅限当前筛选结果中未添加的模型）
   */
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const filteredIds = new Set(filteredModels.map((m) => m.id))
      setModels((prev) => prev.map((m) => (filteredIds.has(m.id) && !m.isAdded ? { ...m, selected: checked } : m)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchText, filterTab]
  )

  /**
   * 编辑模型能力标签
   */
  const handleCapabilitiesChange = useCallback((modelId: string, capabilities: string[]) => {
    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, editedCapabilities: capabilities } : m)))
  }, [])

  /**
   * 筛选后的模型列表
   */
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      // 搜索过滤
      if (searchText && !m.id.toLowerCase().includes(searchText.toLowerCase())) {
        return false
      }
      // 能力筛选
      if (filterTab !== 'all' && !m.editedCapabilities.includes(filterTab)) {
        return false
      }
      return true
    })
  }, [models, searchText, filterTab])

  /**
   * 已选择的模型
   */
  const selectedModels = useMemo(() => models.filter((m) => m.selected), [models])

  /**
   * 可选择的模型数（当前筛选中未添加的）
   */
  const selectableInFilter = useMemo(() => filteredModels.filter((m) => !m.isAdded), [filteredModels])

  /**
   * 当前筛选中是否全选
   */
  const isAllSelected = useMemo(
    () => selectableInFilter.length > 0 && selectableInFilter.every((m) => m.selected),
    [selectableInFilter]
  )

  /**
   * Step 2: 批量添加模型
   */
  const handleBatchCreate = useCallback(async () => {
    if (selectedModels.length === 0) {
      message.warning('请至少选择一个模型')
      return
    }

    setBatchLoading(true)
    try {
      const actualProviderId = isCustomProvider ? customProviderId : providerId
      const config = isCustomProvider ? { providerDisplayName: customProviderName } : undefined

      const response = await modelsApi.batchCreate({
        providerId: actualProviderId,
        apiKey,
        apiEndpoint: apiEndpoint || undefined,
        config,
        models: selectedModels.map((m) => ({
          name: m.id,
          displayName: m.name,
          capabilities: m.editedCapabilities
        }))
      })
      const result = response.data.data
      message.success(
        `成功添加 ${result.created} 个模型${result.skipped > 0 ? `，跳过 ${result.skipped} 个已存在` : ''}`
      )
      handleClose()
      onSuccess()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '批量添加失败')
    } finally {
      setBatchLoading(false)
    }
  }, [
    selectedModels,
    providerId,
    apiKey,
    apiEndpoint,
    isCustomProvider,
    customProviderId,
    customProviderName,
    handleClose,
    onSuccess
  ])

  return (
    <Modal
      title={
        <Space>
          <CloudDownloadOutlined />
          <span>管理模型</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      destroyOnHidden
      width={720}
      footer={null}>
      <Steps
        current={currentStep}
        items={[{ title: '配置供应商' }, { title: '选择模型' }]}
        style={{ marginBottom: 24 }}
      />

      {/* Step 1: 配置供应商 */}
      {currentStep === 0 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>供应商</label>
            <Select
              value={providerId || undefined}
              onChange={handleProviderChange}
              options={providerOptions}
              placeholder="请选择供应商"
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                String(option?.searchLabel ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
            {providerId && !isCustomProvider && !isProviderSupported(providerId) && (
              <div style={{ color: '#faad14', fontSize: 12, marginTop: 4 }}>该供应商需要手动配置 API 端点</div>
            )}
          </div>

          {isCustomProvider && (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
                  供应商标识
                  <Tooltip title="唯一标识符，例如: my-gateway（不可与预设供应商重复）">
                    <span style={{ marginLeft: 4, color: '#999', cursor: 'help' }}>ⓘ</span>
                  </Tooltip>
                </label>
                <Input
                  value={customProviderId}
                  onChange={(e) => {
                    const val = e.target.value
                    setCustomProviderId(val)
                    setCustomProviderIdError(val ? validateCustomProviderId(val) : '')
                  }}
                  placeholder="例如: my-gateway"
                  status={customProviderIdError ? 'error' : undefined}
                />
                {customProviderIdError && (
                  <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{customProviderIdError}</div>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>供应商显示名称</label>
                <Input
                  value={customProviderName}
                  onChange={(e) => setCustomProviderName(e.target.value)}
                  placeholder="例如: 我的 API 网关"
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>API Key</label>
            <Input.Password value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="输入 API Key" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              API 端点
              <span style={{ color: '#999', fontWeight: 400, marginLeft: 4 }}>(选择供应商后自动填充)</span>
            </label>
            <Input
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="例如: https://api.openai.com"
            />
          </div>

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>取消</Button>
              <Button
                type="primary"
                icon={<CloudDownloadOutlined />}
                loading={fetchLoading}
                disabled={
                  !providerId ||
                  !apiKey ||
                  (isCustomProvider && (!customProviderId || !!customProviderIdError || !customProviderName.trim()))
                }
                onClick={handleFetchModels}>
                获取模型列表
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Step 2: 选择模型 */}
      {currentStep === 1 && (
        <div>
          {/* 搜索栏 + 能力筛选 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索模型..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 240 }}
            />
            <Space wrap size={[4, 4]}>
              {FILTER_TABS.map((tab) => (
                <Tag.CheckableTag key={tab.key} checked={filterTab === tab.key} onChange={() => setFilterTab(tab.key)}>
                  {tab.label}
                </Tag.CheckableTag>
              ))}
            </Space>
          </div>

          {/* 全选 + 统计 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
              padding: '8px 12px',
              background: '#fafafa',
              borderRadius: 6
            }}>
            <Checkbox
              checked={isAllSelected}
              indeterminate={selectableInFilter.some((m) => m.selected) && !isAllSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              disabled={selectableInFilter.length === 0}>
              全选当前列表
            </Checkbox>
            <Space>
              <span style={{ fontSize: 13, color: '#666' }}>共 {filteredModels.length} 个模型</span>
              {selectedModels.length > 0 && <Tag color="blue">已选 {selectedModels.length} 个</Tag>}
            </Space>
          </div>

          {/* 模型列表 */}
          <div
            style={{
              maxHeight: 400,
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: 6
            }}>
            {fetchLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="加载中..." />
              </div>
            ) : filteredModels.length === 0 ? (
              <Empty
                description={searchText || filterTab !== 'all' ? '没有匹配的模型' : '未获取到模型'}
                style={{ padding: 40 }}
              />
            ) : (
              filteredModels.map((model) => (
                <ModelListItem
                  key={model.id}
                  model={model}
                  onToggle={toggleModelSelection}
                  onCapabilitiesChange={handleCapabilitiesChange}
                />
              ))
            )}
          </div>

          {/* 底部操作栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16
            }}>
            <Button onClick={() => setCurrentStep(0)}>上一步</Button>
            <Space>
              <Button onClick={handleClose}>取消</Button>
              <Button
                type="primary"
                loading={batchLoading}
                disabled={selectedModels.length === 0}
                onClick={handleBatchCreate}>
                添加所选模型 ({selectedModels.length})
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ============ 子组件 ============

interface ModelListItemProps {
  readonly model: SelectableModel
  readonly onToggle: (id: string) => void
  readonly onCapabilitiesChange: (id: string, capabilities: string[]) => void
}

/**
 * 单个模型列表项
 */
function ModelListItem({ model, onToggle, onCapabilitiesChange }: ModelListItemProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        borderBottom: '1px solid #f0f0f0',
        opacity: model.isAdded ? 0.5 : 1,
        cursor: model.isAdded ? 'not-allowed' : 'pointer',
        background: model.selected ? '#e6f4ff' : 'transparent',
        transition: 'background 0.2s'
      }}
      onClick={() => !model.isAdded && onToggle(model.id)}>
      {/* 勾选框 */}
      <Checkbox
        checked={model.selected}
        disabled={model.isAdded}
        style={{ marginRight: 12 }}
        onClick={(e) => e.stopPropagation()}
        onChange={() => onToggle(model.id)}
      />

      {/* 模型信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title={model.id}>
            <span
              style={{
                fontWeight: 500,
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 300
              }}>
              {model.id}
            </span>
          </Tooltip>
          {model.isAdded && (
            <Tag color="default" style={{ fontSize: 11 }}>
              已添加
            </Tag>
          )}
        </div>

        {/* 能力标签 */}
        <div style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
          <Select
            mode="multiple"
            size="small"
            value={model.editedCapabilities}
            onChange={(values) => onCapabilitiesChange(model.id, values)}
            style={{ width: '100%', maxWidth: 400 }}
            placeholder="选择能力"
            disabled={model.isAdded}
            options={CAPABILITY_OPTIONS.map((opt) => ({
              label: <Tag color={opt.color}>{opt.label}</Tag>,
              value: opt.value
            }))}
          />
        </div>
      </div>
    </div>
  )
}
