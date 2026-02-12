import {
  adminPresentationQuerySchema,
  createPageSchema,
  createPresentationSchema,
  createTemplateSchema,
  descriptionContentSchema,
  editImageSchema,
  exportPresentationSchema,
  generateDescriptionsSchema,
  generateImagesSchema,
  generateOutlineSchema,
  generateSingleImageSchema,
  materialIdParamSchema,
  outlineContentSchema,
  presentationConfigSchema,
  presentationIdParamSchema,
  presentationPageIdParamSchema,
  presentationPaginationSchema,
  presentationQuerySchema,
  presentationSettingsConfigSchema,
  referenceFileIdParamSchema,
  refineDescriptionsSchema,
  refineOutlineSchema,
  reorderPagesSchema,
  taskIdParamSchema,
  templateIdParamSchema,
  updatePageSchema,
  updatePresentationSchema,
  updatePresentationSettingsSchema
} from '@cherry-studio/enterprise-shared'
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001'
const INVALID_UUID = 'not-a-uuid'

// ============ ID 参数 Schema ============

describe('presentationIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = presentationIdParamSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('应拒绝非 UUID 字符串', () => {
    expect(() => presentationIdParamSchema.parse({ id: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝空字符串', () => {
    expect(() => presentationIdParamSchema.parse({ id: '' })).toThrow(ZodError)
  })

  it('应拒绝缺少 id 字段', () => {
    expect(() => presentationIdParamSchema.parse({})).toThrow(ZodError)
  })
})

describe('presentationPageIdParamSchema', () => {
  it('应接受有效的 id 和 pageId', () => {
    const result = presentationPageIdParamSchema.parse({ id: VALID_UUID, pageId: VALID_UUID_2 })
    expect(result.id).toBe(VALID_UUID)
    expect(result.pageId).toBe(VALID_UUID_2)
  })

  it('应拒绝无效的 id', () => {
    expect(() => presentationPageIdParamSchema.parse({ id: INVALID_UUID, pageId: VALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝无效的 pageId', () => {
    expect(() => presentationPageIdParamSchema.parse({ id: VALID_UUID, pageId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝缺少 pageId', () => {
    expect(() => presentationPageIdParamSchema.parse({ id: VALID_UUID })).toThrow(ZodError)
  })
})

describe('taskIdParamSchema', () => {
  it('应接受有效的 taskId', () => {
    const result = taskIdParamSchema.parse({ taskId: VALID_UUID })
    expect(result.taskId).toBe(VALID_UUID)
  })

  it('应拒绝非 UUID 的 taskId', () => {
    expect(() => taskIdParamSchema.parse({ taskId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝缺少 taskId', () => {
    expect(() => taskIdParamSchema.parse({})).toThrow(ZodError)
  })
})

describe('materialIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = materialIdParamSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('应拒绝非 UUID 字符串', () => {
    expect(() => materialIdParamSchema.parse({ id: INVALID_UUID })).toThrow(ZodError)
  })
})

describe('referenceFileIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = referenceFileIdParamSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('应拒绝非 UUID 字符串', () => {
    expect(() => referenceFileIdParamSchema.parse({ id: INVALID_UUID })).toThrow(ZodError)
  })
})

describe('templateIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = templateIdParamSchema.parse({ id: VALID_UUID })
    expect(result.id).toBe(VALID_UUID)
  })

  it('应拒绝非 UUID 字符串', () => {
    expect(() => templateIdParamSchema.parse({ id: INVALID_UUID })).toThrow(ZodError)
  })
})

// ============ 分页 Schema ============

describe('presentationPaginationSchema', () => {
  it('应接受有效的分页参数', () => {
    const result = presentationPaginationSchema.parse({ page: 2, pageSize: 50 })
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(50)
  })

  it('应应用默认值 page=1, pageSize=20', () => {
    const result = presentationPaginationSchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
  })

  it('应将字符串类型的数字强制转换为数字', () => {
    const result = presentationPaginationSchema.parse({ page: '3', pageSize: '30' })
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(30)
  })

  it('应拒绝 page 小于 1', () => {
    expect(() => presentationPaginationSchema.parse({ page: 0 })).toThrow(ZodError)
  })

  it('应拒绝负数 page', () => {
    expect(() => presentationPaginationSchema.parse({ page: -1 })).toThrow(ZodError)
  })

  it('应拒绝 pageSize 小于 1', () => {
    expect(() => presentationPaginationSchema.parse({ pageSize: 0 })).toThrow(ZodError)
  })

  it('应拒绝 pageSize 大于 100', () => {
    expect(() => presentationPaginationSchema.parse({ pageSize: 101 })).toThrow(ZodError)
  })

  it('应接受 pageSize 边界值 1', () => {
    const result = presentationPaginationSchema.parse({ pageSize: 1 })
    expect(result.pageSize).toBe(1)
  })

  it('应接受 pageSize 边界值 100', () => {
    const result = presentationPaginationSchema.parse({ pageSize: 100 })
    expect(result.pageSize).toBe(100)
  })

  it('应拒绝非整数 page', () => {
    expect(() => presentationPaginationSchema.parse({ page: 1.5 })).toThrow(ZodError)
  })
})

// ============ 配置 Schema ============

describe('presentationConfigSchema', () => {
  it('应接受完整的配置对象', () => {
    const config = {
      theme: 'dark',
      language: 'zh-CN',
      pageCount: 10,
      imageStyle: 'realistic',
      imageRatio: '16:9',
      textModelId: VALID_UUID,
      imageModelId: VALID_UUID_2,
      templateId: VALID_UUID
    }
    const result = presentationConfigSchema.parse(config)
    expect(result).toEqual(config)
  })

  it('应接受空对象（所有字段可选）', () => {
    const result = presentationConfigSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受部分配置', () => {
    const result = presentationConfigSchema.parse({ theme: 'light', pageCount: 5 })
    expect(result.theme).toBe('light')
    expect(result.pageCount).toBe(5)
  })

  it('应拒绝 theme 超过 100 字符', () => {
    expect(() => presentationConfigSchema.parse({ theme: 'a'.repeat(101) })).toThrow(ZodError)
  })

  it('应接受 theme 恰好 100 字符', () => {
    const result = presentationConfigSchema.parse({ theme: 'a'.repeat(100) })
    expect(result.theme).toBe('a'.repeat(100))
  })

  it('应拒绝 language 超过 20 字符', () => {
    expect(() => presentationConfigSchema.parse({ language: 'a'.repeat(21) })).toThrow(ZodError)
  })

  it('应拒绝 pageCount 小于 1', () => {
    expect(() => presentationConfigSchema.parse({ pageCount: 0 })).toThrow(ZodError)
  })

  it('应拒绝 pageCount 大于 100', () => {
    expect(() => presentationConfigSchema.parse({ pageCount: 101 })).toThrow(ZodError)
  })

  it('应接受 pageCount 边界值 1 和 100', () => {
    expect(presentationConfigSchema.parse({ pageCount: 1 }).pageCount).toBe(1)
    expect(presentationConfigSchema.parse({ pageCount: 100 }).pageCount).toBe(100)
  })

  it('应拒绝非整数 pageCount', () => {
    expect(() => presentationConfigSchema.parse({ pageCount: 5.5 })).toThrow(ZodError)
  })

  it('应拒绝 imageStyle 超过 100 字符', () => {
    expect(() => presentationConfigSchema.parse({ imageStyle: 'a'.repeat(101) })).toThrow(ZodError)
  })

  it('应拒绝 imageRatio 超过 20 字符', () => {
    expect(() => presentationConfigSchema.parse({ imageRatio: 'a'.repeat(21) })).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 textModelId', () => {
    expect(() => presentationConfigSchema.parse({ textModelId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 imageModelId', () => {
    expect(() => presentationConfigSchema.parse({ imageModelId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 templateId', () => {
    expect(() => presentationConfigSchema.parse({ templateId: INVALID_UUID })).toThrow(ZodError)
  })
})

// ============ 大纲内容 Schema ============

describe('outlineContentSchema', () => {
  it('应接受仅有 title 的最小输入', () => {
    const result = outlineContentSchema.parse({ title: '第一页' })
    expect(result.title).toBe('第一页')
    expect(result.bulletPoints).toBeUndefined()
    expect(result.notes).toBeUndefined()
  })

  it('应接受完整输入', () => {
    const input = {
      title: '介绍',
      bulletPoints: ['要点1', '要点2', '要点3'],
      notes: '演讲者备注'
    }
    const result = outlineContentSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应拒绝空 title', () => {
    expect(() => outlineContentSchema.parse({ title: '' })).toThrow(ZodError)
  })

  it('应拒绝缺少 title', () => {
    expect(() => outlineContentSchema.parse({})).toThrow(ZodError)
  })

  it('应拒绝 title 超过 500 字符', () => {
    expect(() => outlineContentSchema.parse({ title: 'a'.repeat(501) })).toThrow(ZodError)
  })

  it('应接受 title 恰好 500 字符', () => {
    const result = outlineContentSchema.parse({ title: 'a'.repeat(500) })
    expect(result.title).toHaveLength(500)
  })

  it('应拒绝 bulletPoints 中单项超过 1000 字符', () => {
    expect(() => outlineContentSchema.parse({ title: '标题', bulletPoints: ['a'.repeat(1001)] })).toThrow(ZodError)
  })

  it('应接受 bulletPoints 单项恰好 1000 字符', () => {
    const result = outlineContentSchema.parse({ title: '标题', bulletPoints: ['a'.repeat(1000)] })
    expect(result.bulletPoints![0]).toHaveLength(1000)
  })

  it('应拒绝 bulletPoints 超过 20 项', () => {
    const items = Array.from({ length: 21 }, (_, i) => `要点${i}`)
    expect(() => outlineContentSchema.parse({ title: '标题', bulletPoints: items })).toThrow(ZodError)
  })

  it('应接受 bulletPoints 恰好 20 项', () => {
    const items = Array.from({ length: 20 }, (_, i) => `要点${i}`)
    const result = outlineContentSchema.parse({ title: '标题', bulletPoints: items })
    expect(result.bulletPoints).toHaveLength(20)
  })

  it('应拒绝 notes 超过 5000 字符', () => {
    expect(() => outlineContentSchema.parse({ title: '标题', notes: 'a'.repeat(5001) })).toThrow(ZodError)
  })

  it('应接受 notes 恰好 5000 字符', () => {
    const result = outlineContentSchema.parse({ title: '标题', notes: 'a'.repeat(5000) })
    expect(result.notes).toHaveLength(5000)
  })

  it('应接受空的 bulletPoints 数组', () => {
    const result = outlineContentSchema.parse({ title: '标题', bulletPoints: [] })
    expect(result.bulletPoints).toEqual([])
  })
})

// ============ 描述内容 Schema ============

describe('descriptionContentSchema', () => {
  it('应接受仅有 text 的最小输入', () => {
    const result = descriptionContentSchema.parse({ text: '描述文本' })
    expect(result.text).toBe('描述文本')
  })

  it('应接受完整输入', () => {
    const input = {
      text: '详细描述',
      imagePrompt: '一张风景图',
      layout: 'two-column'
    }
    const result = descriptionContentSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应拒绝空 text', () => {
    expect(() => descriptionContentSchema.parse({ text: '' })).toThrow(ZodError)
  })

  it('应拒绝缺少 text', () => {
    expect(() => descriptionContentSchema.parse({})).toThrow(ZodError)
  })

  it('应拒绝 text 超过 5000 字符', () => {
    expect(() => descriptionContentSchema.parse({ text: 'a'.repeat(5001) })).toThrow(ZodError)
  })

  it('应接受 text 恰好 5000 字符', () => {
    const result = descriptionContentSchema.parse({ text: 'a'.repeat(5000) })
    expect(result.text).toHaveLength(5000)
  })

  it('应拒绝 imagePrompt 超过 2000 字符', () => {
    expect(() => descriptionContentSchema.parse({ text: '描述', imagePrompt: 'a'.repeat(2001) })).toThrow(ZodError)
  })

  it('应接受 imagePrompt 恰好 2000 字符', () => {
    const result = descriptionContentSchema.parse({ text: '描述', imagePrompt: 'a'.repeat(2000) })
    expect(result.imagePrompt).toHaveLength(2000)
  })

  it('应拒绝 layout 超过 100 字符', () => {
    expect(() => descriptionContentSchema.parse({ text: '描述', layout: 'a'.repeat(101) })).toThrow(ZodError)
  })
})

// ============ 创建演示文稿 Schema ============

describe('createPresentationSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = createPresentationSchema.parse({
      title: '测试演示文稿',
      creationType: 'idea'
    })
    expect(result.title).toBe('测试演示文稿')
    expect(result.creationType).toBe('idea')
    expect(result.config).toBeUndefined()
    expect(result.sourceContent).toBeUndefined()
  })

  it('应接受完整输入', () => {
    const input = {
      title: '完整演示文稿',
      creationType: 'outline' as const,
      config: { theme: 'dark', pageCount: 10 },
      sourceContent: '原始内容'
    }
    const result = createPresentationSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应接受所有有效的 creationType 枚举值', () => {
    for (const type of ['idea', 'outline', 'description'] as const) {
      const result = createPresentationSchema.parse({ title: '测试', creationType: type })
      expect(result.creationType).toBe(type)
    }
  })

  it('应拒绝空标题', () => {
    expect(() => createPresentationSchema.parse({ title: '', creationType: 'idea' })).toThrow(ZodError)
  })

  it('应拒绝标题超过 300 字符', () => {
    expect(() => createPresentationSchema.parse({ title: 'a'.repeat(301), creationType: 'idea' })).toThrow(ZodError)
  })

  it('应接受标题恰好 300 字符', () => {
    const result = createPresentationSchema.parse({
      title: 'a'.repeat(300),
      creationType: 'idea'
    })
    expect(result.title).toHaveLength(300)
  })

  it('应拒绝无效的 creationType', () => {
    expect(() => createPresentationSchema.parse({ title: '测试', creationType: 'invalid' })).toThrow(ZodError)
  })

  it('应拒绝缺少 creationType', () => {
    expect(() => createPresentationSchema.parse({ title: '测试' })).toThrow(ZodError)
  })

  it('应拒绝 sourceContent 超过 50000 字符', () => {
    expect(() =>
      createPresentationSchema.parse({
        title: '测试',
        creationType: 'idea',
        sourceContent: 'a'.repeat(50001)
      })
    ).toThrow(ZodError)
  })

  it('应接受 sourceContent 恰好 50000 字符', () => {
    const result = createPresentationSchema.parse({
      title: '测试',
      creationType: 'idea',
      sourceContent: 'a'.repeat(50000)
    })
    expect(result.sourceContent).toHaveLength(50000)
  })

  it('应接受嵌套的 config 对象', () => {
    const result = createPresentationSchema.parse({
      title: '测试',
      creationType: 'idea',
      config: { theme: 'modern', language: 'en', textModelId: VALID_UUID }
    })
    expect(result.config?.theme).toBe('modern')
    expect(result.config?.textModelId).toBe(VALID_UUID)
  })
})

// ============ 更新演示文稿 Schema ============

describe('updatePresentationSchema', () => {
  it('应接受空对象（所有字段可选）', () => {
    const result = updatePresentationSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受仅更新标题', () => {
    const result = updatePresentationSchema.parse({ title: '新标题' })
    expect(result.title).toBe('新标题')
  })

  it('应接受仅更新 config', () => {
    const result = updatePresentationSchema.parse({ config: { theme: 'dark' } })
    expect(result.config?.theme).toBe('dark')
  })

  it('应拒绝空标题', () => {
    expect(() => updatePresentationSchema.parse({ title: '' })).toThrow(ZodError)
  })

  it('应拒绝标题超过 300 字符', () => {
    expect(() => updatePresentationSchema.parse({ title: 'a'.repeat(301) })).toThrow(ZodError)
  })

  it('应拒绝 sourceContent 超过 50000 字符', () => {
    expect(() => updatePresentationSchema.parse({ sourceContent: 'a'.repeat(50001) })).toThrow(ZodError)
  })
})

// ============ 查询 Schema ============

describe('presentationQuerySchema', () => {
  it('应应用所有默认值', () => {
    const result = presentationQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.sortBy).toBe('updatedAt')
    expect(result.sortOrder).toBe('desc')
    expect(result.status).toBeUndefined()
    expect(result.search).toBeUndefined()
  })

  it('应接受完整查询参数', () => {
    const input = {
      page: 2,
      pageSize: 10,
      status: 'draft' as const,
      search: '关键词',
      sortBy: 'title' as const,
      sortOrder: 'asc' as const
    }
    const result = presentationQuerySchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应接受所有有效的 status 枚举值', () => {
    const validStatuses = ['draft', 'outline_ready', 'descriptions_ready', 'images_ready', 'completed'] as const
    for (const status of validStatuses) {
      const result = presentationQuerySchema.parse({ status })
      expect(result.status).toBe(status)
    }
  })

  it('应拒绝无效的 status', () => {
    expect(() => presentationQuerySchema.parse({ status: 'invalid' })).toThrow(ZodError)
  })

  it('应接受所有有效的 sortBy 枚举值', () => {
    for (const sortBy of ['createdAt', 'updatedAt', 'title'] as const) {
      const result = presentationQuerySchema.parse({ sortBy })
      expect(result.sortBy).toBe(sortBy)
    }
  })

  it('应拒绝无效的 sortBy', () => {
    expect(() => presentationQuerySchema.parse({ sortBy: 'invalid' })).toThrow(ZodError)
  })

  it('应拒绝 search 超过 200 字符', () => {
    expect(() => presentationQuerySchema.parse({ search: 'a'.repeat(201) })).toThrow(ZodError)
  })

  it('应接受 search 恰好 200 字符', () => {
    const result = presentationQuerySchema.parse({ search: 'a'.repeat(200) })
    expect(result.search).toHaveLength(200)
  })

  it('应支持字符串数字的类型强转（继承分页）', () => {
    const result = presentationQuerySchema.parse({ page: '5', pageSize: '25' })
    expect(result.page).toBe(5)
    expect(result.pageSize).toBe(25)
  })
})

// ============ 页面管理 Schema ============

describe('createPageSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = createPageSchema.parse({
      orderIndex: 0,
      outlineContent: { title: '第一页' }
    })
    expect(result.orderIndex).toBe(0)
    expect(result.outlineContent.title).toBe('第一页')
    expect(result.descriptionContent).toBeUndefined()
  })

  it('应接受完整输入', () => {
    const input = {
      orderIndex: 5,
      outlineContent: { title: '标题', bulletPoints: ['要点'], notes: '备注' },
      descriptionContent: { text: '描述文本', imagePrompt: '图片提示', layout: 'full' }
    }
    const result = createPageSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应拒绝负数 orderIndex', () => {
    expect(() => createPageSchema.parse({ orderIndex: -1, outlineContent: { title: '标题' } })).toThrow(ZodError)
  })

  it('应接受 orderIndex 为 0', () => {
    const result = createPageSchema.parse({ orderIndex: 0, outlineContent: { title: '标题' } })
    expect(result.orderIndex).toBe(0)
  })

  it('应拒绝非整数 orderIndex', () => {
    expect(() => createPageSchema.parse({ orderIndex: 1.5, outlineContent: { title: '标题' } })).toThrow(ZodError)
  })

  it('应拒绝缺少 outlineContent', () => {
    expect(() => createPageSchema.parse({ orderIndex: 0 })).toThrow(ZodError)
  })

  it('应拒绝无效的 outlineContent（空标题）', () => {
    expect(() => createPageSchema.parse({ orderIndex: 0, outlineContent: { title: '' } })).toThrow(ZodError)
  })

  it('应拒绝无效的 descriptionContent（空 text）', () => {
    expect(() =>
      createPageSchema.parse({
        orderIndex: 0,
        outlineContent: { title: '标题' },
        descriptionContent: { text: '' }
      })
    ).toThrow(ZodError)
  })
})

describe('updatePageSchema', () => {
  it('应接受空对象（所有字段可选）', () => {
    const result = updatePageSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受仅更新 orderIndex', () => {
    const result = updatePageSchema.parse({ orderIndex: 3 })
    expect(result.orderIndex).toBe(3)
  })

  it('应接受仅更新 outlineContent', () => {
    const result = updatePageSchema.parse({ outlineContent: { title: '新标题' } })
    expect(result.outlineContent?.title).toBe('新标题')
  })

  it('应接受仅更新 descriptionContent', () => {
    const result = updatePageSchema.parse({ descriptionContent: { text: '新描述' } })
    expect(result.descriptionContent?.text).toBe('新描述')
  })

  it('应拒绝负数 orderIndex', () => {
    expect(() => updatePageSchema.parse({ orderIndex: -1 })).toThrow(ZodError)
  })

  it('应拒绝无效的嵌套 outlineContent', () => {
    expect(() => updatePageSchema.parse({ outlineContent: { title: '' } })).toThrow(ZodError)
  })
})

describe('reorderPagesSchema', () => {
  it('应接受有效的 UUID 数组', () => {
    const result = reorderPagesSchema.parse({ pageIds: [VALID_UUID, VALID_UUID_2] })
    expect(result.pageIds).toEqual([VALID_UUID, VALID_UUID_2])
  })

  it('应接受单个元素的数组', () => {
    const result = reorderPagesSchema.parse({ pageIds: [VALID_UUID] })
    expect(result.pageIds).toHaveLength(1)
  })

  it('应拒绝空数组', () => {
    expect(() => reorderPagesSchema.parse({ pageIds: [] })).toThrow(ZodError)
  })

  it('应拒绝超过 100 个元素的数组', () => {
    const ids = Array.from({ length: 101 }, () => VALID_UUID)
    expect(() => reorderPagesSchema.parse({ pageIds: ids })).toThrow(ZodError)
  })

  it('应接受恰好 100 个元素的数组', () => {
    const ids = Array.from({ length: 100 }, () => VALID_UUID)
    const result = reorderPagesSchema.parse({ pageIds: ids })
    expect(result.pageIds).toHaveLength(100)
  })

  it('应拒绝数组中包含非 UUID 字符串', () => {
    expect(() => reorderPagesSchema.parse({ pageIds: [VALID_UUID, INVALID_UUID] })).toThrow(ZodError)
  })

  it('应拒绝缺少 pageIds', () => {
    expect(() => reorderPagesSchema.parse({})).toThrow(ZodError)
  })
})

// ============ AI 生成 Schema ============

describe('generateOutlineSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = generateOutlineSchema.parse({ idea: '关于AI的演示文稿' })
    expect(result.idea).toBe('关于AI的演示文稿')
    expect(result.config).toBeUndefined()
    expect(result.referenceFileIds).toBeUndefined()
  })

  it('应接受完整输入', () => {
    const input = {
      idea: '人工智能在教育中的应用',
      config: { theme: 'academic', pageCount: 15 },
      referenceFileIds: [VALID_UUID, VALID_UUID_2]
    }
    const result = generateOutlineSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应拒绝空 idea', () => {
    expect(() => generateOutlineSchema.parse({ idea: '' })).toThrow(ZodError)
  })

  it('应拒绝 idea 超过 10000 字符', () => {
    expect(() => generateOutlineSchema.parse({ idea: 'a'.repeat(10001) })).toThrow(ZodError)
  })

  it('应接受 idea 恰好 10000 字符', () => {
    const result = generateOutlineSchema.parse({ idea: 'a'.repeat(10000) })
    expect(result.idea).toHaveLength(10000)
  })

  it('应拒绝 referenceFileIds 超过 10 个', () => {
    const ids = Array.from({ length: 11 }, () => VALID_UUID)
    expect(() => generateOutlineSchema.parse({ idea: '测试', referenceFileIds: ids })).toThrow(ZodError)
  })

  it('应接受 referenceFileIds 恰好 10 个', () => {
    const ids = Array.from({ length: 10 }, () => VALID_UUID)
    const result = generateOutlineSchema.parse({ idea: '测试', referenceFileIds: ids })
    expect(result.referenceFileIds).toHaveLength(10)
  })

  it('应拒绝 referenceFileIds 中包含非 UUID', () => {
    expect(() => generateOutlineSchema.parse({ idea: '测试', referenceFileIds: [INVALID_UUID] })).toThrow(ZodError)
  })
})

describe('refineOutlineSchema', () => {
  it('应接受有效输入', () => {
    const result = refineOutlineSchema.parse({
      instruction: '请增加更多技术细节',
      pages: [{ title: '第一页' }, { title: '第二页', bulletPoints: ['要点'] }]
    })
    expect(result.instruction).toBe('请增加更多技术细节')
    expect(result.pages).toHaveLength(2)
  })

  it('应拒绝空 instruction', () => {
    expect(() => refineOutlineSchema.parse({ instruction: '', pages: [{ title: '标题' }] })).toThrow(ZodError)
  })

  it('应拒绝 instruction 超过 5000 字符', () => {
    expect(() =>
      refineOutlineSchema.parse({
        instruction: 'a'.repeat(5001),
        pages: [{ title: '标题' }]
      })
    ).toThrow(ZodError)
  })

  it('应拒绝空 pages 数组', () => {
    expect(() => refineOutlineSchema.parse({ instruction: '优化', pages: [] })).toThrow(ZodError)
  })

  it('应拒绝 pages 超过 100 个', () => {
    const pages = Array.from({ length: 101 }, (_, i) => ({ title: `第${i}页` }))
    expect(() => refineOutlineSchema.parse({ instruction: '优化', pages })).toThrow(ZodError)
  })

  it('应接受 pages 恰好 100 个', () => {
    const pages = Array.from({ length: 100 }, (_, i) => ({ title: `第${i}页` }))
    const result = refineOutlineSchema.parse({ instruction: '优化', pages })
    expect(result.pages).toHaveLength(100)
  })

  it('应验证 pages 内部的 outlineContentSchema', () => {
    expect(() => refineOutlineSchema.parse({ instruction: '优化', pages: [{ title: '' }] })).toThrow(ZodError)
  })
})

describe('generateDescriptionsSchema', () => {
  it('应接受空对象', () => {
    const result = generateDescriptionsSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受带 config 的输入', () => {
    const result = generateDescriptionsSchema.parse({
      config: { theme: 'modern', language: 'en' }
    })
    expect(result.config?.theme).toBe('modern')
  })

  it('应拒绝无效的 config', () => {
    expect(() => generateDescriptionsSchema.parse({ config: { pageCount: 0 } })).toThrow(ZodError)
  })
})

describe('refineDescriptionsSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = refineDescriptionsSchema.parse({ instruction: '请更详细' })
    expect(result.instruction).toBe('请更详细')
    expect(result.pageIds).toBeUndefined()
  })

  it('应接受带 pageIds 的输入', () => {
    const result = refineDescriptionsSchema.parse({
      instruction: '优化描述',
      pageIds: [VALID_UUID]
    })
    expect(result.pageIds).toEqual([VALID_UUID])
  })

  it('应拒绝空 instruction', () => {
    expect(() => refineDescriptionsSchema.parse({ instruction: '' })).toThrow(ZodError)
  })

  it('应拒绝 instruction 超过 5000 字符', () => {
    expect(() => refineDescriptionsSchema.parse({ instruction: 'a'.repeat(5001) })).toThrow(ZodError)
  })

  it('应拒绝 pageIds 中包含非 UUID', () => {
    expect(() => refineDescriptionsSchema.parse({ instruction: '优化', pageIds: [INVALID_UUID] })).toThrow(ZodError)
  })
})

describe('generateImagesSchema', () => {
  it('应接受空对象', () => {
    const result = generateImagesSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受带 config 和 pageIds 的输入', () => {
    const result = generateImagesSchema.parse({
      config: { imageStyle: 'watercolor' },
      pageIds: [VALID_UUID]
    })
    expect(result.config?.imageStyle).toBe('watercolor')
    expect(result.pageIds).toEqual([VALID_UUID])
  })

  it('应拒绝 pageIds 中包含非 UUID', () => {
    expect(() => generateImagesSchema.parse({ pageIds: [INVALID_UUID] })).toThrow(ZodError)
  })
})

describe('generateSingleImageSchema', () => {
  it('应接受空对象', () => {
    const result = generateSingleImageSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受带 prompt 的输入', () => {
    const result = generateSingleImageSchema.parse({ prompt: '一只猫在编程' })
    expect(result.prompt).toBe('一只猫在编程')
  })

  it('应接受带 config 的输入', () => {
    const result = generateSingleImageSchema.parse({
      config: { imageStyle: '3d', imageRatio: '1:1' }
    })
    expect(result.config?.imageStyle).toBe('3d')
  })

  it('应拒绝空 prompt（min(1)）', () => {
    expect(() => generateSingleImageSchema.parse({ prompt: '' })).toThrow(ZodError)
  })

  it('应拒绝 prompt 超过 2000 字符', () => {
    expect(() => generateSingleImageSchema.parse({ prompt: 'a'.repeat(2001) })).toThrow(ZodError)
  })

  it('应接受 prompt 恰好 2000 字符', () => {
    const result = generateSingleImageSchema.parse({ prompt: 'a'.repeat(2000) })
    expect(result.prompt).toHaveLength(2000)
  })
})

describe('editImageSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = editImageSchema.parse({ instruction: '把背景改为蓝色' })
    expect(result.instruction).toBe('把背景改为蓝色')
    expect(result.maskData).toBeUndefined()
  })

  it('应接受带 maskData 的输入', () => {
    const result = editImageSchema.parse({
      instruction: '修改区域',
      maskData: 'base64encodeddata'
    })
    expect(result.maskData).toBe('base64encodeddata')
  })

  it('应拒绝空 instruction', () => {
    expect(() => editImageSchema.parse({ instruction: '' })).toThrow(ZodError)
  })

  it('应拒绝缺少 instruction', () => {
    expect(() => editImageSchema.parse({})).toThrow(ZodError)
  })

  it('应拒绝 instruction 超过 2000 字符', () => {
    expect(() => editImageSchema.parse({ instruction: 'a'.repeat(2001) })).toThrow(ZodError)
  })

  it('应接受 instruction 恰好 2000 字符', () => {
    const result = editImageSchema.parse({ instruction: 'a'.repeat(2000) })
    expect(result.instruction).toHaveLength(2000)
  })
})

// ============ 导出 Schema ============

describe('exportPresentationSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = exportPresentationSchema.parse({ format: 'pptx' })
    expect(result.format).toBe('pptx')
    expect(result.templateId).toBeUndefined()
    expect(result.config).toBeUndefined()
  })

  it('应接受所有有效的 format 枚举值', () => {
    for (const format of ['pptx', 'pdf', 'editable_pptx'] as const) {
      const result = exportPresentationSchema.parse({ format })
      expect(result.format).toBe(format)
    }
  })

  it('应接受完整输入', () => {
    const result = exportPresentationSchema.parse({
      format: 'pdf',
      templateId: VALID_UUID,
      config: { theme: 'professional' }
    })
    expect(result.format).toBe('pdf')
    expect(result.templateId).toBe(VALID_UUID)
    expect(result.config?.theme).toBe('professional')
  })

  it('应拒绝无效的 format', () => {
    expect(() => exportPresentationSchema.parse({ format: 'docx' })).toThrow(ZodError)
  })

  it('应拒绝缺少 format', () => {
    expect(() => exportPresentationSchema.parse({})).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 templateId', () => {
    expect(() => exportPresentationSchema.parse({ format: 'pptx', templateId: INVALID_UUID })).toThrow(ZodError)
  })
})

// ============ 模板 Schema ============

describe('createTemplateSchema', () => {
  it('应接受有效的最小输入', () => {
    const result = createTemplateSchema.parse({ name: '商务模板' })
    expect(result.name).toBe('商务模板')
    expect(result.isPublic).toBe(false)
    expect(result.description).toBeUndefined()
  })

  it('应接受完整输入', () => {
    const result = createTemplateSchema.parse({
      name: '学术模板',
      description: '适用于学术演示',
      isPublic: true
    })
    expect(result.name).toBe('学术模板')
    expect(result.description).toBe('适用于学术演示')
    expect(result.isPublic).toBe(true)
  })

  it('应应用 isPublic 默认值 false', () => {
    const result = createTemplateSchema.parse({ name: '测试' })
    expect(result.isPublic).toBe(false)
  })

  it('应拒绝空 name', () => {
    expect(() => createTemplateSchema.parse({ name: '' })).toThrow(ZodError)
  })

  it('应拒绝 name 超过 200 字符', () => {
    expect(() => createTemplateSchema.parse({ name: 'a'.repeat(201) })).toThrow(ZodError)
  })

  it('应接受 name 恰好 200 字符', () => {
    const result = createTemplateSchema.parse({ name: 'a'.repeat(200) })
    expect(result.name).toHaveLength(200)
  })

  it('应拒绝 description 超过 2000 字符', () => {
    expect(() => createTemplateSchema.parse({ name: '模板', description: 'a'.repeat(2001) })).toThrow(ZodError)
  })

  it('应接受 description 恰好 2000 字符', () => {
    const result = createTemplateSchema.parse({ name: '模板', description: 'a'.repeat(2000) })
    expect(result.description).toHaveLength(2000)
  })

  it('应拒绝非布尔值 isPublic', () => {
    expect(() => createTemplateSchema.parse({ name: '模板', isPublic: 'yes' })).toThrow(ZodError)
  })
})

// ============ 企业设置 Schema ============

describe('presentationSettingsConfigSchema', () => {
  it('应接受空对象（所有字段可选）', () => {
    const result = presentationSettingsConfigSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受完整配置', () => {
    const input = {
      maxConcurrentTasks: 10,
      maxPages: 50,
      enabledExportFormats: ['pptx', 'pdf'] as const
    }
    const result = presentationSettingsConfigSchema.parse(input)
    expect(result).toEqual(input)
  })

  it('应拒绝 maxConcurrentTasks 小于 1', () => {
    expect(() => presentationSettingsConfigSchema.parse({ maxConcurrentTasks: 0 })).toThrow(ZodError)
  })

  it('应拒绝 maxConcurrentTasks 大于 50', () => {
    expect(() => presentationSettingsConfigSchema.parse({ maxConcurrentTasks: 51 })).toThrow(ZodError)
  })

  it('应接受 maxConcurrentTasks 边界值 1 和 50', () => {
    expect(presentationSettingsConfigSchema.parse({ maxConcurrentTasks: 1 }).maxConcurrentTasks).toBe(1)
    expect(presentationSettingsConfigSchema.parse({ maxConcurrentTasks: 50 }).maxConcurrentTasks).toBe(50)
  })

  it('应拒绝 maxPages 小于 1', () => {
    expect(() => presentationSettingsConfigSchema.parse({ maxPages: 0 })).toThrow(ZodError)
  })

  it('应拒绝 maxPages 大于 200', () => {
    expect(() => presentationSettingsConfigSchema.parse({ maxPages: 201 })).toThrow(ZodError)
  })

  it('应接受 maxPages 边界值 1 和 200', () => {
    expect(presentationSettingsConfigSchema.parse({ maxPages: 1 }).maxPages).toBe(1)
    expect(presentationSettingsConfigSchema.parse({ maxPages: 200 }).maxPages).toBe(200)
  })

  it('应接受有效的 enabledExportFormats', () => {
    const result = presentationSettingsConfigSchema.parse({
      enabledExportFormats: ['pptx', 'pdf', 'editable_pptx']
    })
    expect(result.enabledExportFormats).toEqual(['pptx', 'pdf', 'editable_pptx'])
  })

  it('应拒绝 enabledExportFormats 中包含无效格式', () => {
    expect(() => presentationSettingsConfigSchema.parse({ enabledExportFormats: ['docx'] })).toThrow(ZodError)
  })

  it('应接受空的 enabledExportFormats 数组', () => {
    const result = presentationSettingsConfigSchema.parse({ enabledExportFormats: [] })
    expect(result.enabledExportFormats).toEqual([])
  })

  it('应拒绝非整数 maxConcurrentTasks', () => {
    expect(() => presentationSettingsConfigSchema.parse({ maxConcurrentTasks: 5.5 })).toThrow(ZodError)
  })
})

describe('updatePresentationSettingsSchema', () => {
  it('应接受空对象', () => {
    const result = updatePresentationSettingsSchema.parse({})
    expect(result).toEqual({})
  })

  it('应接受有效的 UUID 作为 defaultTextModelId', () => {
    const result = updatePresentationSettingsSchema.parse({
      defaultTextModelId: VALID_UUID
    })
    expect(result.defaultTextModelId).toBe(VALID_UUID)
  })

  it('应接受 null 作为 defaultTextModelId', () => {
    const result = updatePresentationSettingsSchema.parse({
      defaultTextModelId: null
    })
    expect(result.defaultTextModelId).toBeNull()
  })

  it('应接受 null 作为 defaultImageModelId', () => {
    const result = updatePresentationSettingsSchema.parse({
      defaultImageModelId: null
    })
    expect(result.defaultImageModelId).toBeNull()
  })

  it('应接受完整输入', () => {
    const result = updatePresentationSettingsSchema.parse({
      defaultTextModelId: VALID_UUID,
      defaultImageModelId: VALID_UUID_2,
      config: { maxConcurrentTasks: 20, maxPages: 100 }
    })
    expect(result.defaultTextModelId).toBe(VALID_UUID)
    expect(result.defaultImageModelId).toBe(VALID_UUID_2)
    expect(result.config?.maxConcurrentTasks).toBe(20)
  })

  it('应拒绝非 UUID 的 defaultTextModelId', () => {
    expect(() => updatePresentationSettingsSchema.parse({ defaultTextModelId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 defaultImageModelId', () => {
    expect(() => updatePresentationSettingsSchema.parse({ defaultImageModelId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应验证嵌套的 config', () => {
    expect(() => updatePresentationSettingsSchema.parse({ config: { maxConcurrentTasks: 0 } })).toThrow(ZodError)
  })
})

// ============ Admin 查询 Schema ============

describe('adminPresentationQuerySchema', () => {
  it('应应用所有默认值', () => {
    const result = adminPresentationQuerySchema.parse({})
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.sortBy).toBe('updatedAt')
    expect(result.sortOrder).toBe('desc')
    expect(result.userId).toBeUndefined()
    expect(result.status).toBeUndefined()
    expect(result.search).toBeUndefined()
    expect(result.startDate).toBeUndefined()
    expect(result.endDate).toBeUndefined()
  })

  it('应接受完整查询参数', () => {
    const startDate = new Date('2024-01-01')
    const endDate = new Date('2024-12-31')
    const result = adminPresentationQuerySchema.parse({
      page: 3,
      pageSize: 50,
      userId: VALID_UUID,
      status: 'completed',
      search: '季度报告',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      sortBy: 'createdAt',
      sortOrder: 'asc'
    })
    expect(result.page).toBe(3)
    expect(result.pageSize).toBe(50)
    expect(result.userId).toBe(VALID_UUID)
    expect(result.status).toBe('completed')
    expect(result.search).toBe('季度报告')
    expect(result.startDate).toEqual(startDate)
    expect(result.endDate).toEqual(endDate)
    expect(result.sortBy).toBe('createdAt')
    expect(result.sortOrder).toBe('asc')
  })

  it('应将字符串日期强制转换为 Date 对象', () => {
    const result = adminPresentationQuerySchema.parse({
      startDate: '2024-06-15',
      endDate: '2024-12-31'
    })
    expect(result.startDate).toBeInstanceOf(Date)
    expect(result.endDate).toBeInstanceOf(Date)
  })

  it('应接受 Date 对象作为日期参数', () => {
    const start = new Date('2024-01-01')
    const end = new Date('2024-12-31')
    const result = adminPresentationQuerySchema.parse({
      startDate: start,
      endDate: end
    })
    expect(result.startDate).toEqual(start)
    expect(result.endDate).toEqual(end)
  })

  it('应拒绝无效的日期字符串', () => {
    expect(() => adminPresentationQuerySchema.parse({ startDate: 'not-a-date' })).toThrow(ZodError)
  })

  it('应拒绝非 UUID 的 userId', () => {
    expect(() => adminPresentationQuerySchema.parse({ userId: INVALID_UUID })).toThrow(ZodError)
  })

  it('应接受所有有效的 status 枚举值', () => {
    const validStatuses = ['draft', 'outline_ready', 'descriptions_ready', 'images_ready', 'completed'] as const
    for (const status of validStatuses) {
      const result = adminPresentationQuerySchema.parse({ status })
      expect(result.status).toBe(status)
    }
  })

  it('应拒绝无效的 status', () => {
    expect(() => adminPresentationQuerySchema.parse({ status: 'invalid' })).toThrow(ZodError)
  })

  it('应拒绝 search 超过 200 字符', () => {
    expect(() => adminPresentationQuerySchema.parse({ search: 'a'.repeat(201) })).toThrow(ZodError)
  })

  it('应支持字符串数字的类型强转（继承分页）', () => {
    const result = adminPresentationQuerySchema.parse({ page: '2', pageSize: '10' })
    expect(result.page).toBe(2)
    expect(result.pageSize).toBe(10)
  })

  it('应拒绝无效的 sortBy', () => {
    expect(() => adminPresentationQuerySchema.parse({ sortBy: 'invalid' })).toThrow(ZodError)
  })

  it('应拒绝无效的 sortOrder', () => {
    expect(() => adminPresentationQuerySchema.parse({ sortOrder: 'random' })).toThrow(ZodError)
  })

  it('应接受 ISO 8601 日期时间字符串', () => {
    const result = adminPresentationQuerySchema.parse({
      startDate: '2024-06-15T08:30:00.000Z'
    })
    expect(result.startDate).toBeInstanceOf(Date)
    expect(result.startDate!.toISOString()).toBe('2024-06-15T08:30:00.000Z')
  })

  it('应接受时间戳数字作为日期', () => {
    const timestamp = new Date('2024-06-15').getTime()
    const result = adminPresentationQuerySchema.parse({ startDate: timestamp })
    expect(result.startDate).toBeInstanceOf(Date)
  })
})

// ============ ZodError 详细信息验证 ============

describe('ZodError 详细错误信息', () => {
  it('createPresentationSchema 应包含多个字段错误', () => {
    try {
      createPresentationSchema.parse({ title: '', creationType: 'invalid' })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      const paths = zodError.issues.map((issue) => issue.path[0])
      expect(paths).toContain('title')
      expect(paths).toContain('creationType')
    }
  })

  it('presentationIdParamSchema 应返回自定义错误消息', () => {
    try {
      presentationIdParamSchema.parse({ id: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid presentation ID format')
    }
  })

  it('taskIdParamSchema 应返回自定义错误消息', () => {
    try {
      taskIdParamSchema.parse({ taskId: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid task ID format')
    }
  })

  it('materialIdParamSchema 应返回自定义错误消息', () => {
    try {
      materialIdParamSchema.parse({ id: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid material ID format')
    }
  })

  it('referenceFileIdParamSchema 应返回自定义错误消息', () => {
    try {
      referenceFileIdParamSchema.parse({ id: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid reference file ID format')
    }
  })

  it('templateIdParamSchema 应返回自定义错误消息', () => {
    try {
      templateIdParamSchema.parse({ id: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid template ID format')
    }
  })

  it('presentationPageIdParamSchema 中 pageId 应返回自定义错误消息', () => {
    try {
      presentationPageIdParamSchema.parse({ id: VALID_UUID, pageId: INVALID_UUID })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues[0].message).toBe('Invalid page ID format')
    }
  })
})

// ============ 综合边界测试 ============

describe('综合边界测试', () => {
  it('嵌套 schema 验证：createPageSchema 中的 outlineContent 与 descriptionContent', () => {
    const input = {
      orderIndex: 0,
      outlineContent: {
        title: 'x'.repeat(500),
        bulletPoints: Array.from({ length: 20 }, () => 'b'.repeat(1000)),
        notes: 'n'.repeat(5000)
      },
      descriptionContent: {
        text: 't'.repeat(5000),
        imagePrompt: 'p'.repeat(2000),
        layout: 'l'.repeat(100)
      }
    }
    const result = createPageSchema.parse(input)
    expect(result.outlineContent.title).toHaveLength(500)
    expect(result.outlineContent.bulletPoints).toHaveLength(20)
    expect(result.outlineContent.notes).toHaveLength(5000)
    expect(result.descriptionContent!.text).toHaveLength(5000)
    expect(result.descriptionContent!.imagePrompt).toHaveLength(2000)
    expect(result.descriptionContent!.layout).toHaveLength(100)
  })

  it('超过嵌套边界应失败', () => {
    expect(() =>
      createPageSchema.parse({
        orderIndex: 0,
        outlineContent: {
          title: 'x'.repeat(501)
        }
      })
    ).toThrow(ZodError)
  })

  it('presentationConfigSchema 中所有 UUID 字段应同时验证', () => {
    try {
      presentationConfigSchema.parse({
        textModelId: INVALID_UUID,
        imageModelId: INVALID_UUID,
        templateId: INVALID_UUID
      })
      expect.fail('应该抛出 ZodError')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const zodError = error as ZodError
      expect(zodError.issues).toHaveLength(3)
    }
  })

  it('generateOutlineSchema 应接受带完整嵌套 config 的输入', () => {
    const result = generateOutlineSchema.parse({
      idea: '人工智能',
      config: {
        theme: 'tech',
        language: 'zh',
        pageCount: 20,
        imageStyle: 'flat',
        imageRatio: '4:3',
        textModelId: VALID_UUID,
        imageModelId: VALID_UUID_2
      },
      referenceFileIds: [VALID_UUID]
    })
    expect(result.config?.pageCount).toBe(20)
    expect(result.referenceFileIds).toHaveLength(1)
  })

  it('updatePresentationSettingsSchema 中 nullable UUID 字段区分 null 和 undefined', () => {
    const withNull = updatePresentationSettingsSchema.parse({
      defaultTextModelId: null,
      defaultImageModelId: null
    })
    expect(withNull.defaultTextModelId).toBeNull()
    expect(withNull.defaultImageModelId).toBeNull()

    const withUndefined = updatePresentationSettingsSchema.parse({})
    expect(withUndefined.defaultTextModelId).toBeUndefined()
    expect(withUndefined.defaultImageModelId).toBeUndefined()
  })

  it('presentationQuerySchema 继承 presentationPaginationSchema 并扩展', () => {
    const result = presentationQuerySchema.parse({ page: '1', pageSize: '20' })
    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.sortBy).toBe('updatedAt')
    expect(result.sortOrder).toBe('desc')
  })

  it('adminPresentationQuerySchema 继承分页并增加 admin 专属字段', () => {
    const result = adminPresentationQuerySchema.parse({
      page: '1',
      userId: VALID_UUID,
      startDate: '2024-01-01'
    })
    expect(result.page).toBe(1)
    expect(result.userId).toBe(VALID_UUID)
    expect(result.startDate).toBeInstanceOf(Date)
  })

  it('refineOutlineSchema 中 pages 数组应验证每个元素的 outlineContent', () => {
    const validPages = [
      { title: '页面1', bulletPoints: ['要点1'] },
      { title: '页面2', notes: '备注' }
    ]
    const result = refineOutlineSchema.parse({ instruction: '优化', pages: validPages })
    expect(result.pages).toHaveLength(2)

    expect(() =>
      refineOutlineSchema.parse({
        instruction: '优化',
        pages: [{ title: '有效' }, { title: '' }]
      })
    ).toThrow(ZodError)
  })

  it('exportPresentationSchema 中 config 应验证嵌套规则', () => {
    expect(() =>
      exportPresentationSchema.parse({
        format: 'pptx',
        config: { pageCount: -1 }
      })
    ).toThrow(ZodError)
  })
})
