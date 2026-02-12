// 供应商配置
export * from './providers'

// 供应商默认端点
export * from './endpoints'

// API 路径常量
export const API_VERSION = 'v1'
export const API_PREFIX = `/api/${API_VERSION}`

export const API_ROUTES = {
  // 认证
  AUTH: {
    FEISHU_LOGIN: '/auth/feishu/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me'
  },

  // 用户管理
  USERS: {
    BASE: '/users',
    BY_ID: (id: string) => `/users/${id}`,
    USAGE: (id: string) => `/users/${id}/usage`
  },

  // 部门管理
  DEPARTMENTS: {
    BASE: '/departments',
    BY_ID: (id: string) => `/departments/${id}`,
    TREE: '/departments/tree',
    USERS: (id: string) => `/departments/${id}/users`
  },

  // 角色管理
  ROLES: {
    BASE: '/roles',
    BY_ID: (id: string) => `/roles/${id}`
  },

  // 模型管理
  MODELS: {
    BASE: '/models',
    BY_ID: (id: string) => `/models/${id}`,
    CHAT: (id: string) => `/models/${id}/chat`,
    USAGE: (id: string) => `/models/${id}/usage`,
    PERMISSIONS: (id: string) => `/models/${id}/permissions`,
    FETCH_REMOTE: '/models/fetch-remote',
    BATCH: '/models/batch'
  },

  // 知识库
  KNOWLEDGE_BASES: {
    BASE: '/knowledge-bases',
    BY_ID: (id: string) => `/knowledge-bases/${id}`,
    DOCUMENTS: (id: string) => `/knowledge-bases/${id}/documents`,
    DOCUMENT_BY_ID: (kbId: string, docId: string) => `/knowledge-bases/${kbId}/documents/${docId}`,
    SEARCH: (id: string) => `/knowledge-bases/${id}/search`,
    PERMISSIONS: (id: string) => `/knowledge-bases/${id}/permissions`
  },

  // 对话
  CONVERSATIONS: {
    BASE: '/conversations',
    BY_ID: (id: string) => `/conversations/${id}`,
    MESSAGES: (id: string) => `/conversations/${id}/messages`
  },

  // 统计
  STATISTICS: {
    OVERVIEW: '/statistics/overview',
    USAGE: '/statistics/usage',
    MODELS: '/statistics/models',
    USERS: '/statistics/users',
    EXPORT: '/statistics/export'
  },

  // 管理
  ADMIN: {
    BACKUP: '/admin/backup',
    RESTORE: '/admin/restore',
    BACKUPS: '/admin/backups',
    SETTINGS: '/admin/settings',
    HEALTH: '/admin/health'
  },

  // 提示词助手预设
  ASSISTANT_PRESETS: {
    BASE: '/assistant-presets',
    BY_ID: (id: string) => `/assistant-presets/${id}`,
    TAGS: '/assistant-presets/tags',
    TAG_BY_ID: (id: string) => `/assistant-presets/tags/${id}`,
    SEED: '/assistant-presets/seed',
    CLIENT: '/assistant-presets/client',
    GENERATE_PROMPT: '/assistant-presets/generate-prompt'
  },

  // 演示文稿
  PRESENTATIONS: {
    BASE: '/presentations',
    BY_ID: (id: string) => `/presentations/${id}`,
    GENERATE_OUTLINE: (id: string) => `/presentations/${id}/generate-outline`,
    REFINE_OUTLINE: (id: string) => `/presentations/${id}/refine-outline`,
    GENERATE_DESCRIPTIONS: (id: string) => `/presentations/${id}/generate-descriptions`,
    REFINE_DESCRIPTIONS: (id: string) => `/presentations/${id}/refine-descriptions`,
    GENERATE_IMAGES: (id: string) => `/presentations/${id}/generate-images`,
    PAGE_GENERATE_IMAGE: (id: string, pageId: string) => `/presentations/${id}/pages/${pageId}/generate-image`,
    PAGE_EDIT_IMAGE: (id: string, pageId: string) => `/presentations/${id}/pages/${pageId}/edit-image`,
    PAGES: (id: string) => `/presentations/${id}/pages`,
    PAGE_BY_ID: (id: string, pageId: string) => `/presentations/${id}/pages/${pageId}`,
    PAGES_REORDER: (id: string) => `/presentations/${id}/pages/reorder`,
    EXPORT_PPTX: (id: string) => `/presentations/${id}/export/pptx`,
    EXPORT_PDF: (id: string) => `/presentations/${id}/export/pdf`,
    EXPORT_EDITABLE_PPTX: (id: string) => `/presentations/${id}/export/editable-pptx`,
    TASK_BY_ID: (taskId: string) => `/presentations/tasks/${taskId}`,
    TASK_DOWNLOAD: (taskId: string) => `/presentations/tasks/${taskId}/download`,
    MATERIALS: (id: string) => `/presentations/${id}/materials`,
    MATERIAL_BY_ID: (id: string) => `/presentations/materials/${id}`,
    REFERENCE_FILES: (id: string) => `/presentations/${id}/reference-files`,
    REFERENCE_FILE_BY_ID: (id: string) => `/presentations/reference-files/${id}`,
    TEMPLATES: '/presentations/templates',
    TEMPLATE_BY_ID: (id: string) => `/presentations/templates/${id}`,
    SETTINGS: '/presentations/settings',
    ADMIN_LIST: '/presentations/admin/list',
    ADMIN_STATISTICS: '/presentations/admin/statistics'
  },

  // 学习中心
  LEARNING_CENTER: {
    BASE: '/learning-center',
    CLIENT: '/learning-center/client',
    CLIENT_HOT_ITEMS: '/learning-center/client/hot-items',
    BANNERS: '/learning-center/banners',
    BANNER_BY_ID: (id: string) => `/learning-center/banners/${id}`,
    BANNER_UPLOAD: '/learning-center/banners/upload',
    COURSE_CATEGORIES: '/learning-center/course-categories',
    COURSE_CATEGORY_BY_ID: (id: string) => `/learning-center/course-categories/${id}`,
    COURSES: '/learning-center/courses',
    COURSE_BY_ID: (id: string) => `/learning-center/courses/${id}`,
    COURSE_VIEW: (id: string) => `/learning-center/courses/${id}/view`,
    DOCUMENT_CATEGORIES: '/learning-center/document-categories',
    DOCUMENT_CATEGORY_BY_ID: (id: string) => `/learning-center/document-categories/${id}`,
    DOCUMENTS: '/learning-center/documents',
    DOCUMENT_BY_ID: (id: string) => `/learning-center/documents/${id}`,
    DOCUMENT_VIEW: (id: string) => `/learning-center/documents/${id}/view`,
    HOT_ITEMS: '/learning-center/hot-items',
    HOT_ITEM_BY_ID: (id: string) => `/learning-center/hot-items/${id}`
  }
} as const

// 错误码
export const ERROR_CODES = {
  // 认证错误 (1xxx)
  AUTH_INVALID_TOKEN: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_REFRESH_FAILED: 'AUTH_1003',
  AUTH_FEISHU_FAILED: 'AUTH_1004',
  AUTH_UNAUTHORIZED: 'AUTH_1005',

  // 权限错误 (2xxx)
  PERMISSION_DENIED: 'PERM_2001',
  PERMISSION_ROLE_REQUIRED: 'PERM_2002',
  PERMISSION_RESOURCE_DENIED: 'PERM_2003',

  // 资源错误 (3xxx)
  RESOURCE_NOT_FOUND: 'RES_3001',
  RESOURCE_ALREADY_EXISTS: 'RES_3002',
  RESOURCE_CONFLICT: 'RES_3003',

  // 验证错误 (4xxx)
  VALIDATION_FAILED: 'VAL_4001',
  VALIDATION_INVALID_INPUT: 'VAL_4002',

  // 配额错误 (5xxx)
  QUOTA_EXCEEDED_DAILY: 'QUOTA_5001',
  QUOTA_EXCEEDED_MONTHLY: 'QUOTA_5002',
  QUOTA_EXCEEDED_USER: 'QUOTA_5003',
  QUOTA_STORAGE_EXCEEDED: 'QUOTA_5004',

  // 模型错误 (6xxx)
  MODEL_NOT_AVAILABLE: 'MODEL_6001',
  MODEL_API_ERROR: 'MODEL_6002',
  MODEL_RATE_LIMITED: 'MODEL_6003',

  // 知识库错误 (7xxx)
  KB_PROCESSING_ERROR: 'KB_7001',
  KB_DOCUMENT_TOO_LARGE: 'KB_7002',
  KB_UNSUPPORTED_FORMAT: 'KB_7003',

  // 演示文稿错误 (8xxx)
  PRESENTATION_NOT_FOUND: 'PRES_8001',
  PRESENTATION_PAGE_NOT_FOUND: 'PRES_8002',
  PRESENTATION_TASK_NOT_FOUND: 'PRES_8003',
  PRESENTATION_TASK_FAILED: 'PRES_8004',
  PRESENTATION_EXPORT_FAILED: 'PRES_8005',
  PRESENTATION_FLASK_UNAVAILABLE: 'PRES_8006',
  PRESENTATION_FLASK_ERROR: 'PRES_8007',
  PRESENTATION_TEMPLATE_NOT_FOUND: 'PRES_8008',
  PRESENTATION_MATERIAL_NOT_FOUND: 'PRES_8009',
  PRESENTATION_REFERENCE_FILE_NOT_FOUND: 'PRES_8010',
  PRESENTATION_REFERENCE_FILE_PARSE_FAILED: 'PRES_8011',
  PRESENTATION_MAX_PAGES_EXCEEDED: 'PRES_8012',
  PRESENTATION_CONCURRENT_TASK_LIMIT: 'PRES_8013',

  // 系统错误 (9xxx)
  INTERNAL_ERROR: 'SYS_9001',
  SERVICE_UNAVAILABLE: 'SYS_9002',
  BACKUP_FAILED: 'SYS_9003',
  RESTORE_FAILED: 'SYS_9004'
} as const

// 默认分页
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const

// 文件上传限制
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TOTAL_SIZE: 500 * 1024 * 1024, // 500MB per knowledge base
  ALLOWED_EXTENSIONS: [
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.md',
    '.csv',
    '.xlsx',
    '.xls',
    '.ppt',
    '.pptx',
    '.html',
    '.xml',
    '.json'
  ],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/html',
    'application/xml',
    'application/json'
  ]
} as const

// Banner 图片上传限制（独立于知识库 FILE_LIMITS）
export const BANNER_IMAGE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
} as const

// 系统角色
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user'
} as const

// 默认角色权限
export const DEFAULT_ROLE_PERMISSIONS = {
  [SYSTEM_ROLES.SUPER_ADMIN]: {
    models: ['read', 'use'],
    knowledgeBases: ['read', 'write', 'admin'],
    users: ['read', 'write', 'admin'],
    statistics: ['read', 'export'],
    system: ['backup', 'restore', 'settings'],
    assistantPresets: ['read', 'write', 'admin'],
    learningCenter: ['read', 'write', 'admin'],
    presentations: ['read', 'write', 'export', 'admin']
  },
  [SYSTEM_ROLES.ADMIN]: {
    models: ['read', 'use'],
    knowledgeBases: ['read', 'write', 'admin'],
    users: ['read', 'write'],
    statistics: ['read', 'export'],
    system: ['backup'],
    assistantPresets: ['read', 'write', 'admin'],
    learningCenter: ['read', 'write', 'admin'],
    presentations: ['read', 'write', 'export', 'admin']
  },
  [SYSTEM_ROLES.MANAGER]: {
    models: ['read', 'use'],
    knowledgeBases: ['read', 'write'],
    users: ['read'],
    statistics: ['read'],
    system: [],
    assistantPresets: ['read'],
    learningCenter: ['read'],
    presentations: ['read', 'write', 'export']
  },
  [SYSTEM_ROLES.USER]: {
    models: ['read', 'use'],
    knowledgeBases: ['read'],
    users: [],
    statistics: [],
    system: [],
    assistantPresets: ['read'],
    learningCenter: ['read'],
    presentations: ['read', 'export']
  }
} as const

// Token 配置
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRES_IN: '1h',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  TOKEN_TYPE: 'Bearer'
} as const

// 备份配置
export const BACKUP_CONFIG = {
  DAILY_RETENTION_DAYS: 7,
  WEEKLY_RETENTION_WEEKS: 4,
  MONTHLY_RETENTION_MONTHS: 12,
  DAILY_BACKUP_HOUR: 2,
  WEEKLY_BACKUP_DAY: 0, // Sunday
  MONTHLY_BACKUP_DAY: 1
} as const
