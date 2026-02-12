import type {
  CreatePageInput,
  CreatePresentationInput,
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
  UpdatePresentationInput
} from '@cherry-studio/enterprise-shared'
import type {
  PresentationListItem,
  PresentationPage,
  PresentationSettings,
  PresentationTask,
  PresentationTaskStatus,
  PresentationTemplate,
  PresentationWithPages
} from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import type { PayloadAction } from '@reduxjs/toolkit'
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { presentationApi } from '@renderer/services/PresentationApi'

import type { RootState } from '.'
import { useAppDispatch, useAppSelector } from '.'

const logger = loggerService.withContext('Store:presentations')

// ============ State 类型 ============

export interface PresentationsState {
  /** 列表项（不含完整 pages） */
  items: PresentationListItem[]
  /** 当前正在编辑的完整演示文稿（含 pages） */
  currentPresentation: PresentationWithPages | null
  /** 活跃任务映射表 */
  activeTasks: Record<string, PresentationTask>
  /** 模板列表 */
  templates: PresentationTemplate[]
  /** 企业设置 */
  settings: PresentationSettings | null
  /** 分页信息 */
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  /** 加载状态 */
  loading: {
    list: boolean
    detail: boolean
    creating: boolean
    templates: boolean
    settings: boolean
  }
  /** 列表筛选条件 */
  filters: Partial<PresentationQueryInput>
}

export const initialState: PresentationsState = {
  items: [],
  currentPresentation: null,
  activeTasks: {},
  templates: [],
  settings: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  },
  loading: {
    list: false,
    detail: false,
    creating: false,
    templates: false,
    settings: false
  },
  filters: {
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  }
}

// ============ Async Thunks ============

export const fetchPresentations = createAsyncThunk(
  'presentations/fetchList',
  async (query: Partial<PresentationQueryInput> | undefined, { getState }) => {
    const state = getState() as RootState
    const filters = { ...state.presentations?.filters, ...query }
    const response = await presentationApi.listPresentations(filters)
    return response.data
  }
)

export const fetchPresentation = createAsyncThunk('presentations/fetchDetail', async (id: string) => {
  const response = await presentationApi.getPresentation(id)
  return response.data
})

export const createPresentation = createAsyncThunk('presentations/create', async (input: CreatePresentationInput) => {
  const response = await presentationApi.createPresentation(input)
  return response.data
})

export const updatePresentation = createAsyncThunk(
  'presentations/update',
  async ({ id, input }: { id: string; input: UpdatePresentationInput }) => {
    const response = await presentationApi.updatePresentation(id, input)
    return response.data
  }
)

export const deletePresentation = createAsyncThunk('presentations/delete', async (id: string) => {
  await presentationApi.deletePresentation(id)
  return id
})

// ---- AI 生成 ----

export const generateOutline = createAsyncThunk(
  'presentations/generateOutline',
  async ({ id, input }: { id: string; input: GenerateOutlineInput }) => {
    const response = await presentationApi.generateOutline(id, input)
    return response.data
  }
)

export const refineOutline = createAsyncThunk(
  'presentations/refineOutline',
  async ({ id, input }: { id: string; input: RefineOutlineInput }) => {
    const response = await presentationApi.refineOutline(id, input)
    return response.data
  }
)

export const generateDescriptions = createAsyncThunk(
  'presentations/generateDescriptions',
  async ({ id, input }: { id: string; input?: GenerateDescriptionsInput }) => {
    const response = await presentationApi.generateDescriptions(id, input)
    return response.data
  }
)

export const refineDescriptions = createAsyncThunk(
  'presentations/refineDescriptions',
  async ({ id, input }: { id: string; input: RefineDescriptionsInput }) => {
    const response = await presentationApi.refineDescriptions(id, input)
    return response.data
  }
)

export const generateImages = createAsyncThunk(
  'presentations/generateImages',
  async ({ id, input }: { id: string; input?: GenerateImagesInput }) => {
    const response = await presentationApi.generateImages(id, input)
    return response.data
  }
)

export const generateSingleImage = createAsyncThunk(
  'presentations/generateSingleImage',
  async ({ id, pageId, input }: { id: string; pageId: string; input?: GenerateSingleImageInput }) => {
    const response = await presentationApi.generateSingleImage(id, pageId, input)
    return response.data
  }
)

export const editImage = createAsyncThunk(
  'presentations/editImage',
  async ({ id, pageId, input }: { id: string; pageId: string; input: EditImageInput }) => {
    const response = await presentationApi.editImage(id, pageId, input)
    return response.data
  }
)

// ---- 页面管理 ----

export const createPage = createAsyncThunk(
  'presentations/createPage',
  async ({ id, input }: { id: string; input: CreatePageInput }) => {
    const response = await presentationApi.createPage(id, input)
    return response.data
  }
)

export const updatePage = createAsyncThunk(
  'presentations/updatePage',
  async ({ id, pageId, input }: { id: string; pageId: string; input: UpdatePageInput }) => {
    const response = await presentationApi.updatePage(id, pageId, input)
    return response.data
  }
)

export const deletePage = createAsyncThunk(
  'presentations/deletePage',
  async ({ id, pageId }: { id: string; pageId: string }) => {
    await presentationApi.deletePage(id, pageId)
    return pageId
  }
)

export const reorderPages = createAsyncThunk(
  'presentations/reorderPages',
  async ({ id, input }: { id: string; input: ReorderPagesInput }) => {
    await presentationApi.reorderPages(id, input)
    return input.pageIds
  }
)

// ---- 导出 ----

export const exportPptx = createAsyncThunk('presentations/exportPptx', async (id: string) => {
  const response = await presentationApi.exportPptx(id)
  return response.data
})

export const exportPdf = createAsyncThunk('presentations/exportPdf', async (id: string) => {
  const response = await presentationApi.exportPdf(id)
  return response.data
})

export const exportEditablePptx = createAsyncThunk('presentations/exportEditablePptx', async (id: string) => {
  const response = await presentationApi.exportEditablePptx(id)
  return response.data
})

// ---- 任务轮询 ----

export const pollTask = createAsyncThunk('presentations/pollTask', async (taskId: string) => {
  const response = await presentationApi.getTask(taskId)
  return response.data
})

// ---- 模板 ----

export const fetchTemplates = createAsyncThunk('presentations/fetchTemplates', async () => {
  const response = await presentationApi.listTemplates()
  return response.data
})

export const deleteTemplate = createAsyncThunk('presentations/deleteTemplate', async (templateId: string) => {
  await presentationApi.deleteTemplate(templateId)
  return templateId
})

// ---- 设置 ----

export const fetchSettings = createAsyncThunk('presentations/fetchSettings', async () => {
  const response = await presentationApi.getSettings()
  return response.data
})

export const updateSettings = createAsyncThunk(
  'presentations/updateSettings',
  async (input: Parameters<typeof presentationApi.updateSettings>[0]) => {
    const response = await presentationApi.updateSettings(input)
    return response.data
  }
)

// ============ Slice ============

const presentationsSlice = createSlice({
  name: 'presentations',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<PresentationQueryInput>>) => {
      state.filters = { ...state.filters, ...action.payload }
    },

    clearCurrentPresentation: (state) => {
      state.currentPresentation = null
    },

    updateTaskStatus: (state, action: PayloadAction<{ taskId: string; status: PresentationTaskStatus }>) => {
      const { taskId, status } = action.payload
      const task = state.activeTasks[taskId]
      if (task) {
        state.activeTasks = {
          ...state.activeTasks,
          [taskId]: { ...task, status }
        }
      }
    },

    removeTask: (state, action: PayloadAction<string>) => {
      const { [action.payload]: _removed, ...rest } = state.activeTasks
      state.activeTasks = rest
    },

    clearActiveTasks: (state) => {
      state.activeTasks = {}
    },

    /** 乐观更新：本地更新页面大纲内容（用户编辑时即时反馈） */
    updatePageLocally: (state, action: PayloadAction<{ pageId: string; changes: Partial<PresentationPage> }>) => {
      if (!state.currentPresentation) return
      const { pageId, changes } = action.payload
      state.currentPresentation = {
        ...state.currentPresentation,
        pages: state.currentPresentation.pages.map((p) => (p.id === pageId ? { ...p, ...changes } : p))
      }
    },

    /** 乐观更新：本地重排页面 */
    reorderPagesLocally: (state, action: PayloadAction<string[]>) => {
      if (!state.currentPresentation) return
      const orderedIds = action.payload
      const pageMap = new Map(state.currentPresentation.pages.map((p) => [p.id, p]))
      const reordered = orderedIds
        .map((id, index) => {
          const page = pageMap.get(id)
          return page ? { ...page, orderIndex: index } : null
        })
        .filter((p): p is PresentationPage => p !== null)
      state.currentPresentation = {
        ...state.currentPresentation,
        pages: reordered
      }
    }
  },

  extraReducers: (builder) => {
    // ---- 列表 ----
    builder
      .addCase(fetchPresentations.pending, (state) => {
        state.loading = { ...state.loading, list: true }
      })
      .addCase(fetchPresentations.fulfilled, (state, action) => {
        state.loading = { ...state.loading, list: false }
        state.items = action.payload.items
        state.pagination = action.payload.pagination
      })
      .addCase(fetchPresentations.rejected, (state, action) => {
        state.loading = { ...state.loading, list: false }
        logger.error('Failed to fetch presentations', { error: action.error.message })
      })

    // ---- 详情 ----
    builder
      .addCase(fetchPresentation.pending, (state) => {
        state.loading = { ...state.loading, detail: true }
      })
      .addCase(fetchPresentation.fulfilled, (state, action) => {
        state.loading = { ...state.loading, detail: false }
        state.currentPresentation = action.payload
      })
      .addCase(fetchPresentation.rejected, (state, action) => {
        state.loading = { ...state.loading, detail: false }
        logger.error('Failed to fetch presentation detail', { error: action.error.message })
      })

    // ---- 创建 ----
    builder
      .addCase(createPresentation.pending, (state) => {
        state.loading = { ...state.loading, creating: true }
      })
      .addCase(createPresentation.fulfilled, (state, action) => {
        state.loading = { ...state.loading, creating: false }
        state.items = [{ ...action.payload, previewImageKey: undefined }, ...state.items]
        state.pagination = { ...state.pagination, total: state.pagination.total + 1 }
      })
      .addCase(createPresentation.rejected, (state, action) => {
        state.loading = { ...state.loading, creating: false }
        logger.error('Failed to create presentation', { error: action.error.message })
      })

    // ---- 更新 ----
    builder.addCase(updatePresentation.fulfilled, (state, action) => {
      const updated = action.payload
      state.items = state.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      if (state.currentPresentation?.id === updated.id) {
        state.currentPresentation = { ...state.currentPresentation, ...updated }
      }
    })

    // ---- 删除 ----
    builder.addCase(deletePresentation.fulfilled, (state, action) => {
      const deletedId = action.payload
      state.items = state.items.filter((item) => item.id !== deletedId)
      state.pagination = { ...state.pagination, total: Math.max(0, state.pagination.total - 1) }
      if (state.currentPresentation?.id === deletedId) {
        state.currentPresentation = null
      }
    })

    // ---- AI 任务（统一处理：将返回的 task 加入 activeTasks） ----
    const taskThunks = [
      generateOutline,
      refineOutline,
      generateDescriptions,
      refineDescriptions,
      generateImages,
      generateSingleImage,
      editImage,
      exportPptx,
      exportPdf,
      exportEditablePptx
    ]
    for (const thunk of taskThunks) {
      builder.addCase(thunk.fulfilled, (state, action) => {
        const task = action.payload as PresentationTask
        state.activeTasks = { ...state.activeTasks, [task.id]: task }
      })
    }

    // ---- 任务轮询 ----
    builder.addCase(pollTask.fulfilled, (state, action) => {
      const task = action.payload
      state.activeTasks = { ...state.activeTasks, [task.id]: task }
    })

    // ---- 页面管理 ----
    builder.addCase(createPage.fulfilled, (state, action) => {
      if (state.currentPresentation) {
        state.currentPresentation = {
          ...state.currentPresentation,
          pages: [...state.currentPresentation.pages, action.payload],
          pageCount: state.currentPresentation.pageCount + 1
        }
      }
    })

    builder.addCase(updatePage.fulfilled, (state, action) => {
      if (state.currentPresentation) {
        state.currentPresentation = {
          ...state.currentPresentation,
          pages: state.currentPresentation.pages.map((p) => (p.id === action.payload.id ? action.payload : p))
        }
      }
    })

    builder.addCase(deletePage.fulfilled, (state, action) => {
      if (state.currentPresentation) {
        state.currentPresentation = {
          ...state.currentPresentation,
          pages: state.currentPresentation.pages.filter((p) => p.id !== action.payload),
          pageCount: Math.max(0, state.currentPresentation.pageCount - 1)
        }
      }
    })

    builder.addCase(reorderPages.fulfilled, (state, action) => {
      if (state.currentPresentation) {
        const orderedIds = action.payload
        const pageMap = new Map(state.currentPresentation.pages.map((p) => [p.id, p]))
        const reordered = orderedIds
          .map((id, index) => {
            const page = pageMap.get(id)
            return page ? { ...page, orderIndex: index } : null
          })
          .filter((p): p is PresentationPage => p !== null)
        state.currentPresentation = {
          ...state.currentPresentation,
          pages: reordered
        }
      }
    })

    // ---- 模板 ----
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = { ...state.loading, templates: true }
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = { ...state.loading, templates: false }
        state.templates = action.payload
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = { ...state.loading, templates: false }
        logger.error('Failed to fetch templates', { error: action.error.message })
      })

    builder.addCase(deleteTemplate.fulfilled, (state, action) => {
      state.templates = state.templates.filter((t) => t.id !== action.payload)
    })

    // ---- 设置 ----
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = { ...state.loading, settings: true }
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading = { ...state.loading, settings: false }
        state.settings = action.payload
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = { ...state.loading, settings: false }
        logger.error('Failed to fetch settings', { error: action.error.message })
      })

    builder.addCase(updateSettings.fulfilled, (state, action) => {
      state.settings = action.payload
    })
  }
})

export const {
  setFilters,
  clearCurrentPresentation,
  updateTaskStatus,
  removeTask,
  clearActiveTasks,
  updatePageLocally,
  reorderPagesLocally
} = presentationsSlice.actions

// ============ Selectors ============

export const selectPresentationItems = (state: RootState) => state.presentations?.items ?? []
export const selectCurrentPresentation = (state: RootState) => state.presentations?.currentPresentation ?? null
export const selectPresentationPagination = (state: RootState) =>
  state.presentations?.pagination ?? initialState.pagination
export const selectPresentationLoading = (state: RootState) => state.presentations?.loading ?? initialState.loading
export const selectPresentationFilters = (state: RootState) => state.presentations?.filters ?? initialState.filters
export const selectActiveTasks = (state: RootState) => state.presentations?.activeTasks ?? {}
export const selectTemplates = (state: RootState) => state.presentations?.templates ?? []
export const selectPresentationSettings = (state: RootState) => state.presentations?.settings ?? null

export const selectActiveTaskById = (state: RootState, taskId: string) =>
  state.presentations?.activeTasks?.[taskId] ?? null

export const selectCurrentPages = (state: RootState) => state.presentations?.currentPresentation?.pages ?? []

export const selectRunningTasks = (state: RootState) =>
  Object.values(state.presentations?.activeTasks ?? {}).filter((t) => t.status === 'pending' || t.status === 'running')

// ============ Hooks ============

export function usePresentations() {
  const dispatch = useAppDispatch()
  const items = useAppSelector(selectPresentationItems)
  const pagination = useAppSelector(selectPresentationPagination)
  const loading = useAppSelector(selectPresentationLoading)
  const filters = useAppSelector(selectPresentationFilters)

  return { dispatch, items, pagination, loading, filters }
}

export function useCurrentPresentation() {
  const dispatch = useAppDispatch()
  const presentation = useAppSelector(selectCurrentPresentation)
  const pages = useAppSelector(selectCurrentPages)
  const loading = useAppSelector(selectPresentationLoading)

  return { dispatch, presentation, pages, loading }
}

export function usePresentationTasks() {
  const dispatch = useAppDispatch()
  const activeTasks = useAppSelector(selectActiveTasks)
  const runningTasks = useAppSelector(selectRunningTasks)

  return { dispatch, activeTasks, runningTasks }
}

export default presentationsSlice.reducer
