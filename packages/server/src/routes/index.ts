import { Router } from 'express'

import adminRoutes from './admin'
import authRoutes from './auth'
import conversationRoutes from './conversations'
import departmentRoutes from './departments'
import knowledgeBaseRoutes from './knowledge-bases'
import modelRoutes from './models'
import roleRoutes from './roles'
import statisticsRoutes from './statistics'
import userRoutes from './users'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/departments', departmentRoutes)
router.use('/roles', roleRoutes)
router.use('/models', modelRoutes)
router.use('/knowledge-bases', knowledgeBaseRoutes)
router.use('/conversations', conversationRoutes)
router.use('/statistics', statisticsRoutes)
router.use('/admin', adminRoutes)

export default router
