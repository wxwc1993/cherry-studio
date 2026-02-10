/**
 * 远程模型获取相关 Schema
 *
 * 用于 Admin 管理面板的"管理模型"功能：
 * - 远程获取供应商模型列表
 * - 批量创建模型
 */

import * as z from 'zod'

/**
 * 模型能力标签（与 schemas/index.ts 中的 modelCapabilitySchema 保持一致）
 */
const capabilityEnum = z.enum(['vision', 'reasoning', 'embedding', 'function_calling', 'web_search', 'rerank', 'free'])

// ============ 远程获取模型列表 ============

/**
 * 远程获取模型列表请求 Schema
 */
export const fetchRemoteModelsSchema = z.object({
  /** 供应商 ID（如 'openai'、'anthropic'） */
  providerId: z.string().min(1, 'Provider ID is required'),
  /** API Key */
  apiKey: z.string().min(1, 'API Key is required'),
  /** API 端点（可选，不提供时使用默认端点） */
  apiEndpoint: z.string().url('Invalid endpoint URL').optional().or(z.literal(''))
})

/**
 * 远程获取模型列表响应中的单个模型
 */
export const remoteModelSchema = z.object({
  /** 模型 ID（如 'gpt-4o'） */
  id: z.string(),
  /** 模型显示名称 */
  name: z.string(),
  /** 自动检测到的能力列表 */
  capabilities: z.array(capabilityEnum),
  /** 是否已在系统中添加 */
  isAdded: z.boolean()
})

// ============ 批量创建模型 ============

/**
 * 批量创建模型中的单个模型项
 */
export const batchModelItemSchema = z.object({
  /** 模型 ID（如 'gpt-4o'） */
  name: z.string().min(1).max(200),
  /** 显示名称 */
  displayName: z.string().min(1).max(200),
  /** 模型能力列表（管理员可手动修正后提交） */
  capabilities: z.array(capabilityEnum).optional()
})

/**
 * 批量创建模型请求 Schema
 */
export const batchCreateModelsSchema = z.object({
  /** 供应商 ID */
  providerId: z.string().min(1, 'Provider ID is required'),
  /** API Key（将被加密存储） */
  apiKey: z.string().min(1, 'API Key is required'),
  /** API 端点（可选） */
  apiEndpoint: z.string().url('Invalid endpoint URL').optional().or(z.literal('')),
  /** 批量配置（可选），例如自定义供应商的显示名称 */
  config: z
    .object({
      providerDisplayName: z.string().min(1).max(100).optional()
    })
    .optional(),
  /** 模型列表（1-500 个） */
  models: z.array(batchModelItemSchema).min(1, 'At least one model is required').max(500, 'Too many models (max 500)')
})

// ============ 类型导出 ============

export type FetchRemoteModelsInput = z.infer<typeof fetchRemoteModelsSchema>
export type RemoteModel = z.infer<typeof remoteModelSchema>
export type BatchModelItem = z.infer<typeof batchModelItemSchema>
export type BatchCreateModelsInput = z.infer<typeof batchCreateModelsSchema>
