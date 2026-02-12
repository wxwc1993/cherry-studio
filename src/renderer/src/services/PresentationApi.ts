import type {
  CreatePageInput,
  CreatePresentationInput,
  CreateTemplateInput,
  EditImageInput,
  GenerateDescriptionsInput,
  GenerateImagesInput,
  GenerateOutlineInput,
  GenerateSingleImageInput,
  PresentationQueryInput,
  RefineDescriptionsInput,
  RefineOutlineInput,
  ReorderPagesInput,
  UpdatePageInput,
  UpdatePresentationInput,
  UpdatePresentationSettingsInput
} from '@cherry-studio/enterprise-shared'
import type {
  Presentation,
  PresentationListItem,
  PresentationMaterial,
  PresentationPage,
  PresentationReferenceFile,
  PresentationSettings,
  PresentationTask,
  PresentationTemplate,
  PresentationWithPages
} from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import store from '@renderer/store'
import { clearAuth, updateTokens } from '@renderer/store/enterprise'

const API_PREFIX = '/api/v1'
const PRESENTATIONS_PATH = '/presentations'
const logger = loggerService.withContext('PresentationApi')

// ============ 响应类型 ============

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

interface PaginatedData<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

// ============ API 服务 ============

class PresentationApiService {
  // ---- 内部辅助方法 ----

  private getBaseUrl(): string {
    const state = store.getState()
    return state.enterprise?.enterpriseServer || ''
  }

  private getAccessToken(): string | null {
    const state = store.getState()
    return state.enterprise?.accessToken || null
  }

  private getRefreshToken(): string | null {
    const state = store.getState()
    return state.enterprise?.refreshToken || null
  }

  private getHeaders(): Record<string, string> {
    const accessToken = this.getAccessToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  private getAuthHeaders(): Record<string, string> {
    const accessToken = this.getAccessToken()
    const headers: Record<string, string> = {}
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  private async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    try {
      const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      })

      if (!response.ok) return false

      const data = await response.json()
      store.dispatch(
        updateTokens({
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken
        })
      )
      return true
    } catch {
      return false
    }
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (response.status === 401) {
      const refreshed = await this.refreshTokens()
      if (!refreshed) {
        store.dispatch(clearAuth())
        throw new Error('Authentication expired')
      }
      throw new Error('Token refreshed, please retry')
    }

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed')
    }
    return data
  }

  private async request<T>(method: string, endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}${endpoint}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined
      })
      return await this.handleResponse<T>(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('API request failed', { method, endpoint, error: errorMessage })
      throw error
    }
  }

  private async requestWithFile<T>(method: string, endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}${endpoint}`, {
        method,
        headers: this.getAuthHeaders(),
        body: formData
      })
      return await this.handleResponse<T>(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('File upload request failed', { method, endpoint, error: errorMessage })
      throw error
    }
  }

  // ============ 演示文稿 CRUD ============

  async createPresentation(input: CreatePresentationInput): Promise<ApiResponse<Presentation>> {
    return this.request<Presentation>('POST', PRESENTATIONS_PATH, input)
  }

  async listPresentations(
    query?: Partial<PresentationQueryInput>
  ): Promise<ApiResponse<PaginatedData<PresentationListItem>>> {
    const params = new URLSearchParams()
    if (query?.page) params.set('page', String(query.page))
    if (query?.pageSize) params.set('pageSize', String(query.pageSize))
    if (query?.status) params.set('status', query.status)
    if (query?.search) params.set('search', query.search)
    if (query?.sortBy) params.set('sortBy', query.sortBy)
    if (query?.sortOrder) params.set('sortOrder', query.sortOrder)

    const qs = params.toString()
    const endpoint = qs ? `${PRESENTATIONS_PATH}?${qs}` : PRESENTATIONS_PATH
    return this.request<PaginatedData<PresentationListItem>>('GET', endpoint)
  }

  async getPresentation(id: string): Promise<ApiResponse<PresentationWithPages>> {
    return this.request<PresentationWithPages>('GET', `${PRESENTATIONS_PATH}/${id}`)
  }

  async updatePresentation(id: string, input: UpdatePresentationInput): Promise<ApiResponse<Presentation>> {
    return this.request<Presentation>('PATCH', `${PRESENTATIONS_PATH}/${id}`, input)
  }

  async deletePresentation(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `${PRESENTATIONS_PATH}/${id}`)
  }

  // ============ AI 生成 ============

  async generateOutline(id: string, input: GenerateOutlineInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/generate-outline`, input)
  }

  async refineOutline(id: string, input: RefineOutlineInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/refine-outline`, input)
  }

  async generateDescriptions(id: string, input?: GenerateDescriptionsInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/generate-descriptions`, input)
  }

  async refineDescriptions(id: string, input: RefineDescriptionsInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/refine-descriptions`, input)
  }

  async generateImages(id: string, input?: GenerateImagesInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/generate-images`, input)
  }

  async generateSingleImage(
    id: string,
    pageId: string,
    input?: GenerateSingleImageInput
  ): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/pages/${pageId}/generate-image`, input)
  }

  async editImage(id: string, pageId: string, input: EditImageInput): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/pages/${pageId}/edit-image`, input)
  }

  // ============ 页面管理 ============

  async updatePage(id: string, pageId: string, input: UpdatePageInput): Promise<ApiResponse<PresentationPage>> {
    return this.request<PresentationPage>('PATCH', `${PRESENTATIONS_PATH}/${id}/pages/${pageId}`, input)
  }

  async deletePage(id: string, pageId: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `${PRESENTATIONS_PATH}/${id}/pages/${pageId}`)
  }

  async createPage(id: string, input: CreatePageInput): Promise<ApiResponse<PresentationPage>> {
    return this.request<PresentationPage>('POST', `${PRESENTATIONS_PATH}/${id}/pages`, input)
  }

  async reorderPages(id: string, input: ReorderPagesInput): Promise<ApiResponse<void>> {
    return this.request<void>('POST', `${PRESENTATIONS_PATH}/${id}/pages/reorder`, input)
  }

  // ============ 导出 ============

  async exportPptx(id: string): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/export/pptx`)
  }

  async exportPdf(id: string): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/export/pdf`)
  }

  async exportEditablePptx(id: string): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('POST', `${PRESENTATIONS_PATH}/${id}/export/editable-pptx`)
  }

  // ============ 任务 ============

  async getTask(taskId: string): Promise<ApiResponse<PresentationTask>> {
    return this.request<PresentationTask>('GET', `${PRESENTATIONS_PATH}/tasks/${taskId}`)
  }

  async downloadTaskResult(taskId: string): Promise<Blob> {
    const response = await fetch(`${this.getBaseUrl()}${API_PREFIX}${PRESENTATIONS_PATH}/tasks/${taskId}/download`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })

    if (response.status === 401) {
      const refreshed = await this.refreshTokens()
      if (!refreshed) {
        store.dispatch(clearAuth())
        throw new Error('Authentication expired')
      }
      throw new Error('Token refreshed, please retry')
    }

    if (!response.ok) {
      throw new Error('Failed to download task result')
    }

    return response.blob()
  }

  // ============ 素材管理 ============

  async uploadMaterial(id: string, file: File): Promise<ApiResponse<PresentationMaterial>> {
    const formData = new FormData()
    formData.append('file', file)
    return this.requestWithFile<PresentationMaterial>('POST', `${PRESENTATIONS_PATH}/${id}/materials`, formData)
  }

  async listMaterials(id: string): Promise<ApiResponse<PresentationMaterial[]>> {
    return this.request<PresentationMaterial[]>('GET', `${PRESENTATIONS_PATH}/${id}/materials`)
  }

  async deleteMaterial(materialId: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `${PRESENTATIONS_PATH}/materials/${materialId}`)
  }

  // ============ 参考文件管理 ============

  async uploadReferenceFile(id: string, file: File): Promise<ApiResponse<PresentationReferenceFile>> {
    const formData = new FormData()
    formData.append('file', file)
    return this.requestWithFile<PresentationReferenceFile>(
      'POST',
      `${PRESENTATIONS_PATH}/${id}/reference-files`,
      formData
    )
  }

  async listReferenceFiles(id: string): Promise<ApiResponse<PresentationReferenceFile[]>> {
    return this.request<PresentationReferenceFile[]>('GET', `${PRESENTATIONS_PATH}/${id}/reference-files`)
  }

  async deleteReferenceFile(fileId: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `${PRESENTATIONS_PATH}/reference-files/${fileId}`)
  }

  // ============ 模板管理 ============

  async listTemplates(): Promise<ApiResponse<PresentationTemplate[]>> {
    return this.request<PresentationTemplate[]>('GET', `${PRESENTATIONS_PATH}/templates`)
  }

  async createTemplate(input: CreateTemplateInput, file: File): Promise<ApiResponse<PresentationTemplate>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', input.name)
    if (input.description) {
      formData.append('description', input.description)
    }
    formData.append('isPublic', String(input.isPublic))
    return this.requestWithFile<PresentationTemplate>('POST', `${PRESENTATIONS_PATH}/templates`, formData)
  }

  async deleteTemplate(templateId: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `${PRESENTATIONS_PATH}/templates/${templateId}`)
  }

  // ============ 图像 URL ============

  /**
   * 根据 OSS 存储 key 构建图像访问 URL
   * 用于模板预览图和页面生成图像等场景
   */
  getImageUrl(storageKey: string): string {
    return `${this.getBaseUrl()}${API_PREFIX}${PRESENTATIONS_PATH}/files/${storageKey}`
  }

  // ============ 企业设置 ============

  async getSettings(): Promise<ApiResponse<PresentationSettings>> {
    return this.request<PresentationSettings>('GET', `${PRESENTATIONS_PATH}/settings`)
  }

  async updateSettings(input: UpdatePresentationSettingsInput): Promise<ApiResponse<PresentationSettings>> {
    return this.request<PresentationSettings>('PATCH', `${PRESENTATIONS_PATH}/settings`, input)
  }
}

export const presentationApi = new PresentationApiService()
