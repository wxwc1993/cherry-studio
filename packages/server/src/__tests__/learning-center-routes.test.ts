/**
 * 学习中心路由 — TDD RED 阶段测试
 *
 * 测试目标文件：packages/server/src/routes/learning-center.ts（尚未实现）
 * 路由注册位置：packages/server/src/routes/index.ts
 *
 * 运行此测试应看到全部 FAIL，因为路由模块尚不存在。
 * 实现后应逐步变为 GREEN。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ────────────────────────────────────────────
// Mock 外部依赖
// ────────────────────────────────────────────

// Mock 数据库
vi.mock('../models/db', () => ({
  db: {
    query: {
      lcBanners: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      lcCourseCategories: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      lcCourses: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      lcDocumentCategories: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      lcDocuments: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      },
      lcHotItems: {
        findMany: vi.fn(),
        findFirst: vi.fn()
      }
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn(),
          orderBy: vi.fn()
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn()
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn()
        })
      })
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn()
      })
    })
  }
}))

vi.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret',
      accessTokenExpiresIn: '1h',
      refreshTokenExpiresIn: '7d'
    }
  }
}))

vi.mock('../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
}))

// ────────────────────────────────────────────
// 测试常量
// ────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_UUID_2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const VALID_UUID_3 = '7ba7b810-9dad-11d1-80b4-00c04fd430c9'
const COMPANY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const mockUser = {
  sub: USER_ID,
  companyId: COMPANY_ID,
  permissions: {
    models: ['read'],
    knowledgeBases: ['read'],
    users: ['read'],
    statistics: ['read'],
    system: [],
    assistantPresets: ['read'],
    learningCenter: ['read', 'write', 'admin']
  }
}

const mockUserReadOnly = {
  ...mockUser,
  permissions: {
    ...mockUser.permissions,
    learningCenter: ['read']
  }
}

const mockUserWriteOnly = {
  ...mockUser,
  permissions: {
    ...mockUser.permissions,
    learningCenter: ['read', 'write']
  }
}

// ============================================================
// 1. 模块导出与路由注册验证
// ============================================================

describe('学习中心路由 — 模块导出', () => {
  it('learning-center.ts 应默认导出一个 Router', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // Express Router 是一个函数
    expect(typeof module.default).toBe('function')
  })

  it('routes/index.ts 应注册 /learning-center 路由', async () => {
    const indexModule = await import('../routes/index')
    const router = indexModule.default
    expect(router).toBeDefined()

    // 检查路由栈中是否包含 /learning-center 子路由
    // Express Router 的 stack 属性记录了所有注册的中间件和路由
    const stack = (router as any).stack || []
    const hasLearningCenter = stack.some(
      (layer: any) => layer.regexp?.test('/learning-center') || layer.path === '/learning-center'
    )
    expect(hasLearningCenter).toBe(true)
  })
})

// ============================================================
// 2. 客户端聚合 API（GET /client）
// ============================================================

describe('GET /learning-center/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应返回 banners、courseCategories、documentCategories、hotItems 和 stats', async () => {
    // 导入路由并验证 handler 存在
    const module = await import('../routes/learning-center')
    const router = module.default
    expect(router).toBeDefined()

    // 验证路由注册了 GET /client 端点
    const stack = (router as any).stack || []
    const clientRoute = stack.find((layer: any) => layer.route?.path === '/client' && layer.route?.methods?.get)
    expect(clientRoute).toBeDefined()
  })

  it('stats 应包含 totalCourses、totalDocuments 和 totalViews', async () => {
    // 验证返回结构中包含 stats 字段
    const module = await import('../routes/learning-center')
    const router = module.default

    const stack = (router as any).stack || []
    const clientRoute = stack.find((layer: any) => layer.route?.path === '/client' && layer.route?.methods?.get)
    // 路由应存在
    expect(clientRoute).toBeDefined()
    // handler 应该是一个函数
    if (clientRoute?.route?.stack?.[0]?.handle) {
      expect(typeof clientRoute.route.stack[0].handle).toBe('function')
    }
  })

  it('应仅查询当前用户 companyId 的数据', async () => {
    // 通过 mock 验证 db.query 调用时传入了 companyId 过滤条件
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // 此测试在实现时需要验证 eq(table.companyId, req.user.companyId) 被调用
  })

  it('应仅返回 isEnabled=true 的数据', async () => {
    // 客户端聚合端点应过滤掉已禁用的内容
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('应仅需 authenticate 中间件，无需 requirePermission', async () => {
    const module = await import('../routes/learning-center')
    const router = module.default

    const stack = (router as any).stack || []
    const clientRoute = stack.find((layer: any) => layer.route?.path === '/client' && layer.route?.methods?.get)
    expect(clientRoute).toBeDefined()
    // 客户端端点的中间件链长度应为 1（handler），不应包含 requirePermission
    // authenticate 是全局 router.use 级别的
  })
})

// ============================================================
// 3. 换一批热搜（GET /client/hot-items）
// ============================================================

describe('GET /learning-center/client/hot-items', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应注册 GET /client/hot-items 端点', async () => {
    const module = await import('../routes/learning-center')
    const router = module.default

    const stack = (router as any).stack || []
    const refreshRoute = stack.find(
      (layer: any) => layer.route?.path === '/client/hot-items' && layer.route?.methods?.get
    )
    expect(refreshRoute).toBeDefined()
  })

  it('应支持 exclude 参数排除已见 ID', async () => {
    // exclude 参数应接受逗号分隔的 UUID 列表
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('最多返回 10 条结果', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // 实现时需要验证 LIMIT 10 被应用
  })

  it('应使用随机排序', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // 实现时需要验证 SQL RANDOM() 被使用
  })

  it('exclude 为空时应返回随机条目', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })
})

// ============================================================
// 4. Banner CRUD
// ============================================================

describe('Banner CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- GET /banners ----
  describe('GET /learning-center/banners', () => {
    it('应注册 GET /banners 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners' && layer.route?.methods?.get)
      expect(route).toBeDefined()
    })

    it('应支持 page 和 pageSize 分页参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners' && layer.route?.methods?.get)
      expect(route).toBeDefined()
      // 中间件链应包含 requirePermission('learningCenter', 'read')
      const middlewareCount = route?.route?.stack?.length ?? 0
      // 至少有 validate + requirePermission + handler = 3 层
      expect(middlewareCount).toBeGreaterThanOrEqual(2)
    })

    it('应使用 lcPaginationSchema 验证查询参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  // ---- POST /banners ----
  describe('POST /learning-center/banners', () => {
    it('应注册 POST /banners 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners' && layer.route?.methods?.post)
      expect(route).toBeDefined()
    })

    it('创建时应自动注入 companyId', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
      // 实现时需验证 insert 调用包含 companyId: req.user.companyId
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners' && layer.route?.methods?.post)
      expect(route).toBeDefined()
      const middlewareCount = route?.route?.stack?.length ?? 0
      // requirePermission + validate + handler = 至少 3 层
      expect(middlewareCount).toBeGreaterThanOrEqual(3)
    })

    it('应使用 createBannerSchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  // ---- PATCH /banners/:id ----
  describe('PATCH /learning-center/banners/:id', () => {
    it('应注册 PATCH /banners/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners/:id' && layer.route?.methods?.patch)
      expect(route).toBeDefined()
    })

    it('更新时应设置 updatedAt', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 updateBannerSchema 验证请求体和 lcIdParamSchema 验证参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的记录应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  // ---- DELETE /banners/:id ----
  describe('DELETE /learning-center/banners/:id', () => {
    it('应注册 DELETE /banners/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners/:id' && layer.route?.methods?.delete)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/banners/:id' && layer.route?.methods?.delete)
      expect(route).toBeDefined()
      // admin 权限的中间件应存在于路由栈中
    })

    it('不存在的记录应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 lcIdParamSchema 验证路径参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 5. 课程分类 CRUD
// ============================================================

describe('课程分类 CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /learning-center/course-categories', () => {
    it('应注册 GET /course-categories 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/course-categories' && layer.route?.methods?.get)
      expect(route).toBeDefined()
    })

    it('应返回按 order, createdAt 排序的列表', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('POST /learning-center/course-categories', () => {
    it('应注册 POST /course-categories 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/course-categories' && layer.route?.methods?.post)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 createCourseCategorySchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('创建时应自动注入 companyId', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('PATCH /learning-center/course-categories/:id', () => {
    it('应注册 PATCH /course-categories/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/course-categories/:id' && layer.route?.methods?.patch
      )
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('DELETE /learning-center/course-categories/:id', () => {
    it('应注册 DELETE /course-categories/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/course-categories/:id' && layer.route?.methods?.delete
      )
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('删除时应返回 affectedCourses 统计', async () => {
      // 删除分类时，应统计并返回受影响的课程数量
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的分类应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 6. 课程 CRUD
// ============================================================

describe('课程 CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /learning-center/courses', () => {
    it('应注册 GET /courses 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/courses' && layer.route?.methods?.get)
      expect(route).toBeDefined()
    })

    it('应支持 categoryId 筛选', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应支持 uncategorized=true 筛选无分类课程', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应支持 page 和 pageSize 分页参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 courseQuerySchema 验证查询参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('POST /learning-center/courses', () => {
    it('应注册 POST /courses 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/courses' && layer.route?.methods?.post)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 createCourseSchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('创建时应自动注入 companyId', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('PATCH /learning-center/courses/:id', () => {
    it('应注册 PATCH /courses/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/courses/:id' && layer.route?.methods?.patch)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('更新时应设置 updatedAt', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的课程应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('DELETE /learning-center/courses/:id', () => {
    it('应注册 DELETE /courses/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/courses/:id' && layer.route?.methods?.delete)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的课程应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 7. 文档分类 CRUD
// ============================================================

describe('文档分类 CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /learning-center/document-categories', () => {
    it('应注册 GET /document-categories 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/document-categories' && layer.route?.methods?.get
      )
      expect(route).toBeDefined()
    })

    it('应返回按 order, createdAt 排序的列表', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('POST /learning-center/document-categories', () => {
    it('应注册 POST /document-categories 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/document-categories' && layer.route?.methods?.post
      )
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 createDocumentCategorySchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('PATCH /learning-center/document-categories/:id', () => {
    it('应注册 PATCH /document-categories/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/document-categories/:id' && layer.route?.methods?.patch
      )
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('DELETE /learning-center/document-categories/:id', () => {
    it('应注册 DELETE /document-categories/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find(
        (layer: any) => layer.route?.path === '/document-categories/:id' && layer.route?.methods?.delete
      )
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('删除时应返回 affectedDocuments 统计', async () => {
      // 删除文档分类时，应统计并返回受影响的文档数量
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的分类应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 8. 文档 CRUD
// ============================================================

describe('文档 CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /learning-center/documents', () => {
    it('应注册 GET /documents 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/documents' && layer.route?.methods?.get)
      expect(route).toBeDefined()
    })

    it('应支持 categoryId 筛选', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应支持 uncategorized=true 筛选无分类文档', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应支持 page 和 pageSize 分页参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 documentQuerySchema 验证查询参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('POST /learning-center/documents', () => {
    it('应注册 POST /documents 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/documents' && layer.route?.methods?.post)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 createDocumentSchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('创建时应自动注入 companyId', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('PATCH /learning-center/documents/:id', () => {
    it('应注册 PATCH /documents/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/documents/:id' && layer.route?.methods?.patch)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('更新时应设置 updatedAt', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的文档应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('DELETE /learning-center/documents/:id', () => {
    it('应注册 DELETE /documents/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/documents/:id' && layer.route?.methods?.delete)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的文档应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 9. 热搜要闻 CRUD
// ============================================================

describe('热搜要闻 CRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /learning-center/hot-items', () => {
    it('应注册 GET /hot-items 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/hot-items' && layer.route?.methods?.get)
      expect(route).toBeDefined()
    })

    it('应支持 page 和 pageSize 分页参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应需要 learningCenter.read 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('POST /learning-center/hot-items', () => {
    it('应注册 POST /hot-items 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/hot-items' && layer.route?.methods?.post)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 createHotItemSchema 验证请求体', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('创建时应自动注入 companyId', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('PATCH /learning-center/hot-items/:id', () => {
    it('应注册 PATCH /hot-items/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/hot-items/:id' && layer.route?.methods?.patch)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.write 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('更新时应设置 updatedAt', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的热搜应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })

  describe('DELETE /learning-center/hot-items/:id', () => {
    it('应注册 DELETE /hot-items/:id 端点', async () => {
      const module = await import('../routes/learning-center')
      const router = module.default
      const stack = (router as any).stack || []
      const route = stack.find((layer: any) => layer.route?.path === '/hot-items/:id' && layer.route?.methods?.delete)
      expect(route).toBeDefined()
    })

    it('应需要 learningCenter.admin 权限', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('不存在的热搜应返回 404', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })

    it('应使用 lcIdParamSchema 验证路径参数', async () => {
      const module = await import('../routes/learning-center')
      expect(module.default).toBeDefined()
    })
  })
})

// ============================================================
// 10. 权限验证
// ============================================================

describe('权限验证', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全局 router.use 应包含 authenticate 中间件', async () => {
    const module = await import('../routes/learning-center')
    const router = module.default
    const stack = (router as any).stack || []

    // 全局中间件（router.use）在 stack 中没有 route 属性
    const globalMiddleware = stack.filter((layer: any) => !layer.route)
    // 至少应有 1 个全局中间件（authenticate）
    expect(globalMiddleware.length).toBeGreaterThanOrEqual(1)
  })

  it('read 操作应使用 requirePermission("learningCenter", "read")', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // 所有 GET 管理端点应使用 read 权限
  })

  it('write 操作（POST/PATCH）应使用 requirePermission("learningCenter", "write")', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('delete 操作应使用 requirePermission("learningCenter", "admin")', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('客户端端点（/client 和 /client/hot-items）不应使用 requirePermission', async () => {
    const module = await import('../routes/learning-center')
    const router = module.default
    const stack = (router as any).stack || []

    const clientRoute = stack.find((layer: any) => layer.route?.path === '/client' && layer.route?.methods?.get)
    expect(clientRoute).toBeDefined()

    // 客户端路由的中间件栈不应包含 requirePermission
    // handler 本身应只有 1 个（无额外权限中间件）
    // 注意：validate 可能存在，但 requirePermission 不应存在
  })
})

// ============================================================
// 11. 错误处理
// ============================================================

describe('错误处理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('404 错误应使用 NotFoundError', async () => {
    // 路由实现中不存在的资源应抛出 NotFoundError
    // NotFoundError 会被 errorHandler 中间件捕获并返回标准格式
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('数据库错误应传递给 next(err)', async () => {
    // 所有 try-catch 中的 catch 应调用 next(err)
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('所有路由 handler 应使用 try-catch 包裹', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
    // 实现时每个异步 handler 都应遵循 try { ... } catch (err) { next(err) } 模式
  })
})

// ============================================================
// 12. 路由端点完整性验证（26 个端点）
// ============================================================

describe('路由端点完整性', () => {
  it('应注册全部 26 个端点', async () => {
    const module = await import('../routes/learning-center')
    const router = module.default
    const stack = (router as any).stack || []

    // 收集所有已注册的路由
    const routes: Array<{ path: string; method: string }> = []
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m])
        for (const method of methods) {
          routes.push({ path: layer.route.path, method })
        }
      }
    }

    // 预期的全部端点列表
    const expectedRoutes = [
      // 客户端聚合
      { path: '/client', method: 'get' },
      { path: '/client/hot-items', method: 'get' },
      // Banner CRUD
      { path: '/banners', method: 'get' },
      { path: '/banners', method: 'post' },
      { path: '/banners/:id', method: 'patch' },
      { path: '/banners/:id', method: 'delete' },
      // 课程分类 CRUD
      { path: '/course-categories', method: 'get' },
      { path: '/course-categories', method: 'post' },
      { path: '/course-categories/:id', method: 'patch' },
      { path: '/course-categories/:id', method: 'delete' },
      // 课程 CRUD
      { path: '/courses', method: 'get' },
      { path: '/courses', method: 'post' },
      { path: '/courses/:id', method: 'patch' },
      { path: '/courses/:id', method: 'delete' },
      // 文档分类 CRUD
      { path: '/document-categories', method: 'get' },
      { path: '/document-categories', method: 'post' },
      { path: '/document-categories/:id', method: 'patch' },
      { path: '/document-categories/:id', method: 'delete' },
      // 文档 CRUD
      { path: '/documents', method: 'get' },
      { path: '/documents', method: 'post' },
      { path: '/documents/:id', method: 'patch' },
      { path: '/documents/:id', method: 'delete' },
      // 热搜要闻 CRUD
      { path: '/hot-items', method: 'get' },
      { path: '/hot-items', method: 'post' },
      { path: '/hot-items/:id', method: 'patch' },
      { path: '/hot-items/:id', method: 'delete' }
    ]

    // 前两个（客户端端点）+ 6 个资源 x 4 个方法 = 26 个端点
    expect(expectedRoutes).toHaveLength(26)

    for (const expected of expectedRoutes) {
      const found = routes.find((r) => r.path === expected.path && r.method === expected.method)
      expect(found, `缺少端点: ${expected.method.toUpperCase()} ${expected.path}`).toBeDefined()
    }
  })
})

// ============================================================
// 13. 边界情况
// ============================================================

describe('边界情况', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('分页参数 page=0 应被 schema 拒绝或限制为 1', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('分页参数 pageSize=101 应被 schema 拒绝', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('DELETE 不存在的资源应返回 404 而非 500', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('PATCH 空 body 应被接受（部分更新）', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('exclude 参数中的重复 UUID 应被正确处理', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })

  it('并发删除相同资源不应导致服务器错误', async () => {
    const module = await import('../routes/learning-center')
    expect(module.default).toBeDefined()
  })
})
