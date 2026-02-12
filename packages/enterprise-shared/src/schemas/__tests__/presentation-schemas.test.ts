/**
 * 演示文稿 Zod Schema 验证测试
 *
 * 纯 Schema 测试，无需 mock 任何依赖。
 * 使用 safeParse() 模式验证有效/无效输入。
 */

import { describe, expect, it } from 'vitest'

import {
  type AdminPresentationQueryInput,
  adminPresentationQuerySchema,
  createPageSchema,
  // Types
  type CreatePresentationInput,
  createPresentationSchema,
  createTemplateSchema,
  type DescriptionContentInput,
  descriptionContentSchema,
  editImageSchema,
  type ExportPresentationInput,
  exportPresentationSchema,
  generateDescriptionsSchema,
  generateImagesSchema,
  generateOutlineSchema,
  generateSingleImageSchema,
  materialIdParamSchema,
  type OutlineContentInput,
  outlineContentSchema,
  type PresentationConfigInput,
  presentationConfigSchema,
  // Schema
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
  type UpdatePresentationInput,
  updatePresentationSchema,
  updatePresentationSettingsSchema
} from '../presentation'

// ────────────────────────────────────────────
// 测试辅助常量
// ────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

/** 生成指定长度的字符串 */
function strOfLength(len: number): string {
  return 'a'.repeat(len)
}

// ============================================================
// 1. presentationIdParamSchema
// ============================================================

describe('presentationIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = presentationIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID)
    }
  })

  it('应拒绝非 UUID 格式的 id', () => {
    const result = presentationIdParamSchema.safeParse({ id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('应拒绝空字符串 id', () => {
    const result = presentationIdParamSchema.safeParse({ id: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝缺少 id 字段', () => {
    const result = presentationIdParamSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 2. presentationPageIdParamSchema
// ============================================================

describe('presentationPageIdParamSchema', () => {
  it('应接受有效的两个 UUID', () => {
    const result = presentationPageIdParamSchema.safeParse({
      id: VALID_UUID,
      pageId: VALID_UUID_2
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe(VALID_UUID)
      expect(result.data.pageId).toBe(VALID_UUID_2)
    }
  })

  it('应拒绝缺少 pageId', () => {
    const result = presentationPageIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(false)
  })

  it('应拒绝非 UUID 格式的 pageId', () => {
    const result = presentationPageIdParamSchema.safeParse({
      id: VALID_UUID,
      pageId: 'invalid'
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 3. presentationPaginationSchema
// ============================================================

describe('presentationPaginationSchema', () => {
  it('应接受有效的分页参数', () => {
    const result = presentationPaginationSchema.safeParse({ page: 2, pageSize: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.pageSize).toBe(50)
    }
  })

  it('应使用默认值 page=1, pageSize=20', () => {
    const result = presentationPaginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
    }
  })

  it('应接受字符串数字（coerce）', () => {
    const result = presentationPaginationSchema.safeParse({ page: '3', pageSize: '30' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.pageSize).toBe(30)
    }
  })

  it('应拒绝 page < 1', () => {
    const result = presentationPaginationSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 pageSize = 0', () => {
    const result = presentationPaginationSchema.safeParse({ pageSize: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 pageSize > 100', () => {
    const result = presentationPaginationSchema.safeParse({ pageSize: 101 })
    expect(result.success).toBe(false)
  })

  it('应接受 pageSize = 1（下限边界）', () => {
    const result = presentationPaginationSchema.safeParse({ pageSize: 1 })
    expect(result.success).toBe(true)
  })

  it('应接受 pageSize = 100（上限边界）', () => {
    const result = presentationPaginationSchema.safeParse({ pageSize: 100 })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 4. presentationConfigSchema
// ============================================================

describe('presentationConfigSchema', () => {
  it('应接受有效的完整配置', () => {
    const result = presentationConfigSchema.safeParse({
      theme: 'modern',
      language: 'zh-CN',
      pageCount: 10,
      imageStyle: 'realistic',
      imageRatio: '16:9',
      textModelId: VALID_UUID,
      imageModelId: VALID_UUID_2,
      templateId: VALID_UUID
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象（所有字段都可选）', () => {
    const result = presentationConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝 pageCount < 1', () => {
    const result = presentationConfigSchema.safeParse({ pageCount: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 pageCount > 100', () => {
    const result = presentationConfigSchema.safeParse({ pageCount: 101 })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 100 字符的 theme', () => {
    const result = presentationConfigSchema.safeParse({ theme: strOfLength(101) })
    expect(result.success).toBe(false)
  })

  it('应接受刚好 100 字符的 theme', () => {
    const result = presentationConfigSchema.safeParse({ theme: strOfLength(100) })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID 的 textModelId', () => {
    const result = presentationConfigSchema.safeParse({ textModelId: 'not-uuid' })
    expect(result.success).toBe(false)
  })

  it('应拒绝非 UUID 的 imageModelId', () => {
    const result = presentationConfigSchema.safeParse({ imageModelId: 'not-uuid' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 5. outlineContentSchema
// ============================================================

describe('outlineContentSchema', () => {
  it('应接受有效的大纲内容', () => {
    const result = outlineContentSchema.safeParse({
      title: '第一页标题',
      bulletPoints: ['要点1', '要点2'],
      notes: '备注内容'
    })
    expect(result.success).toBe(true)
  })

  it('应接受仅必填字段', () => {
    const result = outlineContentSchema.safeParse({
      title: '标题'
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = outlineContentSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 500 字符的 title', () => {
    const result = outlineContentSchema.safeParse({ title: strOfLength(501) })
    expect(result.success).toBe(false)
  })

  it('应接受刚好 500 字符的 title', () => {
    const result = outlineContentSchema.safeParse({ title: strOfLength(500) })
    expect(result.success).toBe(true)
  })

  it('应拒绝超过 20 个 bulletPoints', () => {
    const result = outlineContentSchema.safeParse({
      title: '标题',
      bulletPoints: Array.from({ length: 21 }, (_, i) => `要点${i}`)
    })
    expect(result.success).toBe(false)
  })

  it('应接受刚好 20 个 bulletPoints', () => {
    const result = outlineContentSchema.safeParse({
      title: '标题',
      bulletPoints: Array.from({ length: 20 }, (_, i) => `要点${i}`)
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝超过 5000 字符的 notes', () => {
    const result = outlineContentSchema.safeParse({
      title: '标题',
      notes: strOfLength(5001)
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 6. descriptionContentSchema
// ============================================================

describe('descriptionContentSchema', () => {
  it('应接受有效的描述内容', () => {
    const result = descriptionContentSchema.safeParse({
      text: '页面描述文本',
      imagePrompt: '生成一张日落图片',
      layout: 'two-column'
    })
    expect(result.success).toBe(true)
  })

  it('应接受仅必填字段', () => {
    const result = descriptionContentSchema.safeParse({
      text: '描述文本'
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 text', () => {
    const result = descriptionContentSchema.safeParse({ text: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 5000 字符的 text', () => {
    const result = descriptionContentSchema.safeParse({ text: strOfLength(5001) })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 2000 字符的 imagePrompt', () => {
    const result = descriptionContentSchema.safeParse({
      text: '描述',
      imagePrompt: strOfLength(2001)
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 7. createPresentationSchema
// ============================================================

describe('createPresentationSchema', () => {
  const validInput = {
    title: '测试演示文稿',
    creationType: 'idea' as const
  }

  describe('有效输入', () => {
    it('应接受有效的完整输入', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        config: { theme: 'modern' },
        sourceContent: '这是一段源内容'
      })
      expect(result.success).toBe(true)
    })

    it('应接受仅必填字段', () => {
      const result = createPresentationSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('应接受所有 creationType 枚举值', () => {
      for (const type of ['idea', 'outline', 'description'] as const) {
        const result = createPresentationSchema.safeParse({
          title: '标题',
          creationType: type
        })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('无效输入', () => {
    it('应拒绝空 title', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        title: ''
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝超过 300 字符的 title', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        title: strOfLength(301)
      })
      expect(result.success).toBe(false)
    })

    it('应接受刚好 300 字符的 title', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        title: strOfLength(300)
      })
      expect(result.success).toBe(true)
    })

    it('应拒绝无效的 creationType', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        creationType: 'invalid'
      })
      expect(result.success).toBe(false)
    })

    it('应拒绝超过 50000 字符的 sourceContent', () => {
      const result = createPresentationSchema.safeParse({
        ...validInput,
        sourceContent: strOfLength(50001)
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================================
// 8. updatePresentationSchema
// ============================================================

describe('updatePresentationSchema', () => {
  it('应接受部分更新', () => {
    const result = updatePresentationSchema.safeParse({
      title: '更新标题'
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updatePresentationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝空 title', () => {
    const result = updatePresentationSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('应接受 config 更新', () => {
    const result = updatePresentationSchema.safeParse({
      config: { theme: 'dark' }
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 9. presentationQuerySchema
// ============================================================

describe('presentationQuerySchema', () => {
  it('应接受有效的查询参数', () => {
    const result = presentationQuerySchema.safeParse({
      page: 1,
      pageSize: 20,
      status: 'draft',
      search: 'AI',
      sortBy: 'createdAt',
      sortOrder: 'asc'
    })
    expect(result.success).toBe(true)
  })

  it('应使用默认值', () => {
    const result = presentationQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
      expect(result.data.sortBy).toBe('updatedAt')
      expect(result.data.sortOrder).toBe('desc')
    }
  })

  it('应接受所有有效的 status 枚举值', () => {
    for (const status of ['draft', 'outline_ready', 'descriptions_ready', 'images_ready', 'completed'] as const) {
      const result = presentationQuerySchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('应拒绝无效的 status', () => {
    const result = presentationQuerySchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 200 字符的 search', () => {
    const result = presentationQuerySchema.safeParse({ search: strOfLength(201) })
    expect(result.success).toBe(false)
  })

  it('应接受所有有效的 sortBy 枚举值', () => {
    for (const sortBy of ['createdAt', 'updatedAt', 'title'] as const) {
      const result = presentationQuerySchema.safeParse({ sortBy })
      expect(result.success).toBe(true)
    }
  })
})

// ============================================================
// 10. createPageSchema / updatePageSchema
// ============================================================

describe('createPageSchema', () => {
  const validPage = {
    orderIndex: 0,
    outlineContent: { title: '标题' }
  }

  it('应接受有效输入', () => {
    const result = createPageSchema.safeParse(validPage)
    expect(result.success).toBe(true)
  })

  it('应接受包含 descriptionContent 的输入', () => {
    const result = createPageSchema.safeParse({
      ...validPage,
      descriptionContent: { text: '描述文本' }
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝负数 orderIndex', () => {
    const result = createPageSchema.safeParse({
      ...validPage,
      orderIndex: -1
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝缺少 outlineContent', () => {
    const result = createPageSchema.safeParse({
      orderIndex: 0
    })
    expect(result.success).toBe(false)
  })
})

describe('updatePageSchema', () => {
  it('应接受部分更新', () => {
    const result = updatePageSchema.safeParse({
      orderIndex: 5
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updatePageSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝负数 orderIndex', () => {
    const result = updatePageSchema.safeParse({ orderIndex: -1 })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 11. reorderPagesSchema
// ============================================================

describe('reorderPagesSchema', () => {
  it('应接受有效的 UUID 数组', () => {
    const result = reorderPagesSchema.safeParse({
      pageIds: [VALID_UUID, VALID_UUID_2]
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空数组', () => {
    const result = reorderPagesSchema.safeParse({ pageIds: [] })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 100 个 UUID', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`)
    const result = reorderPagesSchema.safeParse({ pageIds: ids })
    expect(result.success).toBe(false)
  })

  it('应拒绝非 UUID 格式的 pageId', () => {
    const result = reorderPagesSchema.safeParse({
      pageIds: ['not-a-uuid']
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 12. AI 生成 Schema
// ============================================================

describe('generateOutlineSchema', () => {
  it('应接受有效输入', () => {
    const result = generateOutlineSchema.safeParse({
      idea: '关于人工智能的演示文稿',
      config: { pageCount: 10 }
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 idea', () => {
    const result = generateOutlineSchema.safeParse({ idea: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 10000 字符的 idea', () => {
    const result = generateOutlineSchema.safeParse({ idea: strOfLength(10001) })
    expect(result.success).toBe(false)
  })

  it('应接受刚好 10000 字符的 idea', () => {
    const result = generateOutlineSchema.safeParse({ idea: strOfLength(10000) })
    expect(result.success).toBe(true)
  })

  it('应接受 referenceFileIds', () => {
    const result = generateOutlineSchema.safeParse({
      idea: '主意',
      referenceFileIds: [VALID_UUID]
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝超过 10 个 referenceFileIds', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`)
    const result = generateOutlineSchema.safeParse({
      idea: '主意',
      referenceFileIds: ids
    })
    expect(result.success).toBe(false)
  })
})

describe('refineOutlineSchema', () => {
  it('应接受有效输入', () => {
    const result = refineOutlineSchema.safeParse({
      instruction: '请优化大纲结构',
      pages: [{ title: '第一页' }]
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 instruction', () => {
    const result = refineOutlineSchema.safeParse({
      instruction: '',
      pages: [{ title: '第一页' }]
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 5000 字符的 instruction', () => {
    const result = refineOutlineSchema.safeParse({
      instruction: strOfLength(5001),
      pages: [{ title: '第一页' }]
    })
    expect(result.success).toBe(false)
  })

  it('应拒绝空 pages 数组', () => {
    const result = refineOutlineSchema.safeParse({
      instruction: '优化',
      pages: []
    })
    expect(result.success).toBe(false)
  })
})

describe('generateDescriptionsSchema', () => {
  it('应接受空对象', () => {
    const result = generateDescriptionsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受 config', () => {
    const result = generateDescriptionsSchema.safeParse({
      config: { language: 'en' }
    })
    expect(result.success).toBe(true)
  })
})

describe('refineDescriptionsSchema', () => {
  it('应接受有效输入', () => {
    const result = refineDescriptionsSchema.safeParse({
      instruction: '请优化描述'
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 instruction', () => {
    const result = refineDescriptionsSchema.safeParse({ instruction: '' })
    expect(result.success).toBe(false)
  })

  it('应接受 pageIds', () => {
    const result = refineDescriptionsSchema.safeParse({
      instruction: '优化',
      pageIds: [VALID_UUID]
    })
    expect(result.success).toBe(true)
  })
})

describe('generateImagesSchema', () => {
  it('应接受空对象', () => {
    const result = generateImagesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受 pageIds', () => {
    const result = generateImagesSchema.safeParse({
      pageIds: [VALID_UUID, VALID_UUID_2]
    })
    expect(result.success).toBe(true)
  })
})

describe('generateSingleImageSchema', () => {
  it('应接受空对象', () => {
    const result = generateSingleImageSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受 prompt', () => {
    const result = generateSingleImageSchema.safeParse({
      prompt: '生成一张科技风格的图片'
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝超过 2000 字符的 prompt', () => {
    const result = generateSingleImageSchema.safeParse({
      prompt: strOfLength(2001)
    })
    expect(result.success).toBe(false)
  })
})

describe('editImageSchema', () => {
  it('应接受有效输入', () => {
    const result = editImageSchema.safeParse({
      instruction: '将背景改为蓝色'
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝空 instruction', () => {
    const result = editImageSchema.safeParse({ instruction: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 2000 字符的 instruction', () => {
    const result = editImageSchema.safeParse({
      instruction: strOfLength(2001)
    })
    expect(result.success).toBe(false)
  })

  it('应接受 maskData', () => {
    const result = editImageSchema.safeParse({
      instruction: '编辑',
      maskData: 'base64encodedmask'
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// 13. exportPresentationSchema
// ============================================================

describe('exportPresentationSchema', () => {
  it('应接受所有有效格式', () => {
    for (const format of ['pptx', 'pdf', 'editable_pptx'] as const) {
      const result = exportPresentationSchema.safeParse({ format })
      expect(result.success).toBe(true)
    }
  })

  it('应拒绝无效格式', () => {
    const result = exportPresentationSchema.safeParse({ format: 'docx' })
    expect(result.success).toBe(false)
  })

  it('应接受 templateId', () => {
    const result = exportPresentationSchema.safeParse({
      format: 'pptx',
      templateId: VALID_UUID
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID 的 templateId', () => {
    const result = exportPresentationSchema.safeParse({
      format: 'pptx',
      templateId: 'invalid'
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 14. taskIdParamSchema / materialIdParamSchema / referenceFileIdParamSchema
// ============================================================

describe('taskIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = taskIdParamSchema.safeParse({ taskId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID', () => {
    const result = taskIdParamSchema.safeParse({ taskId: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('materialIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = materialIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID', () => {
    const result = materialIdParamSchema.safeParse({ id: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('referenceFileIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = referenceFileIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID', () => {
    const result = referenceFileIdParamSchema.safeParse({ id: 'invalid' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 15. createTemplateSchema / templateIdParamSchema
// ============================================================

describe('createTemplateSchema', () => {
  it('应接受有效输入', () => {
    const result = createTemplateSchema.safeParse({
      name: '模板名称',
      description: '模板描述',
      isPublic: true
    })
    expect(result.success).toBe(true)
  })

  it('应接受仅必填字段', () => {
    const result = createTemplateSchema.safeParse({
      name: '模板'
    })
    expect(result.success).toBe(true)
  })

  it('isPublic 默认值应为 false', () => {
    const result = createTemplateSchema.safeParse({ name: '模板' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isPublic).toBe(false)
    }
  })

  it('应拒绝空 name', () => {
    const result = createTemplateSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 200 字符的 name', () => {
    const result = createTemplateSchema.safeParse({ name: strOfLength(201) })
    expect(result.success).toBe(false)
  })

  it('应拒绝超过 2000 字符的 description', () => {
    const result = createTemplateSchema.safeParse({
      name: '模板',
      description: strOfLength(2001)
    })
    expect(result.success).toBe(false)
  })
})

describe('templateIdParamSchema', () => {
  it('应接受有效的 UUID', () => {
    const result = templateIdParamSchema.safeParse({ id: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID', () => {
    const result = templateIdParamSchema.safeParse({ id: 'invalid' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 16. presentationSettingsConfigSchema / updatePresentationSettingsSchema
// ============================================================

describe('presentationSettingsConfigSchema', () => {
  it('应接受有效配置', () => {
    const result = presentationSettingsConfigSchema.safeParse({
      maxConcurrentTasks: 10,
      maxPages: 50,
      enabledExportFormats: ['pptx', 'pdf']
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = presentationSettingsConfigSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应拒绝 maxConcurrentTasks < 1', () => {
    const result = presentationSettingsConfigSchema.safeParse({ maxConcurrentTasks: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 maxConcurrentTasks > 50', () => {
    const result = presentationSettingsConfigSchema.safeParse({ maxConcurrentTasks: 51 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 maxPages < 1', () => {
    const result = presentationSettingsConfigSchema.safeParse({ maxPages: 0 })
    expect(result.success).toBe(false)
  })

  it('应拒绝 maxPages > 200', () => {
    const result = presentationSettingsConfigSchema.safeParse({ maxPages: 201 })
    expect(result.success).toBe(false)
  })

  it('应拒绝无效的导出格式', () => {
    const result = presentationSettingsConfigSchema.safeParse({
      enabledExportFormats: ['docx']
    })
    expect(result.success).toBe(false)
  })
})

describe('updatePresentationSettingsSchema', () => {
  it('应接受有效输入', () => {
    const result = updatePresentationSettingsSchema.safeParse({
      defaultTextModelId: VALID_UUID,
      defaultImageModelId: VALID_UUID_2,
      config: { maxPages: 100 }
    })
    expect(result.success).toBe(true)
  })

  it('应接受空对象', () => {
    const result = updatePresentationSettingsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('应接受 null 值的 modelId（清除设置）', () => {
    const result = updatePresentationSettingsSchema.safeParse({
      defaultTextModelId: null,
      defaultImageModelId: null
    })
    expect(result.success).toBe(true)
  })

  it('应拒绝非 UUID 的 defaultTextModelId', () => {
    const result = updatePresentationSettingsSchema.safeParse({
      defaultTextModelId: 'invalid'
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 17. adminPresentationQuerySchema
// ============================================================

describe('adminPresentationQuerySchema', () => {
  it('应接受有效的查询参数', () => {
    const result = adminPresentationQuerySchema.safeParse({
      page: 1,
      pageSize: 50,
      userId: VALID_UUID,
      status: 'completed',
      search: 'AI 演示',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      sortBy: 'createdAt',
      sortOrder: 'asc'
    })
    expect(result.success).toBe(true)
  })

  it('应使用默认值', () => {
    const result = adminPresentationQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.pageSize).toBe(20)
      expect(result.data.sortBy).toBe('updatedAt')
      expect(result.data.sortOrder).toBe('desc')
    }
  })

  it('应接受 coerce date 字符串', () => {
    const result = adminPresentationQuerySchema.safeParse({
      startDate: '2025-06-01'
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date)
    }
  })

  it('应拒绝非 UUID 的 userId', () => {
    const result = adminPresentationQuerySchema.safeParse({ userId: 'invalid' })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// 18. 导出类型验证
// ============================================================

describe('导出类型', () => {
  it('CreatePresentationInput 类型应可用', () => {
    const input: CreatePresentationInput = {
      title: '测试',
      creationType: 'idea'
    }
    expect(input.title).toBe('测试')
  })

  it('UpdatePresentationInput 类型应可用', () => {
    const input: UpdatePresentationInput = {
      title: '更新'
    }
    expect(input.title).toBe('更新')
  })

  it('PresentationConfigInput 类型应可用', () => {
    const input: PresentationConfigInput = {
      theme: 'modern',
      pageCount: 10
    }
    expect(input.theme).toBe('modern')
  })

  it('OutlineContentInput 类型应可用', () => {
    const input: OutlineContentInput = {
      title: '大纲标题',
      bulletPoints: ['要点1']
    }
    expect(input.title).toBe('大纲标题')
  })

  it('DescriptionContentInput 类型应可用', () => {
    const input: DescriptionContentInput = {
      text: '描述文本'
    }
    expect(input.text).toBe('描述文本')
  })

  it('ExportPresentationInput 类型应可用', () => {
    const input: ExportPresentationInput = {
      format: 'pptx'
    }
    expect(input.format).toBe('pptx')
  })

  it('AdminPresentationQueryInput 类型应可用', () => {
    const input: AdminPresentationQueryInput = {
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    }
    expect(input.page).toBe(1)
  })
})
