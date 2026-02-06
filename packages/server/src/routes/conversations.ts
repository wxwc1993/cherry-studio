import { createPagination, createSuccessResponse } from '@cherry-studio/enterprise-shared'
import { desc, eq, sql } from 'drizzle-orm'
import { Router } from 'express'

import { authenticate } from '../middleware/auth'
import { AuthorizationError, NotFoundError } from '../middleware/errorHandler'
import { db } from '../models/db'
import { conversations, messages } from '../models/schema'

const router = Router()

// 所有路由都需要认证
router.use(authenticate)

// 获取用户对话列表
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20

    const offset = (page - 1) * pageSize

    // 获取总数
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.userId, userId))

    // 获取对话列表
    const result = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(pageSize)
      .offset(offset)

    const data = result.map((conv) => ({
      id: conv.id,
      title: conv.title,
      modelId: conv.modelId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString()
    }))

    const pagination = createPagination(Number(count), { page, pageSize })

    res.json(createSuccessResponse(data, pagination))
  } catch (error) {
    next(error)
  }
})

// 获取单个对话及其消息
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user!.sub

    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id))

    if (!conversation) {
      throw new NotFoundError('对话不存在')
    }

    // 检查是否是用户自己的对话
    if (conversation.userId !== userId) {
      throw new AuthorizationError('无权访问此对话')
    }

    // 获取消息列表
    const messageList = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt)

    res.json(
      createSuccessResponse({
        id: conversation.id,
        title: conversation.title,
        modelId: conversation.modelId,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messages: messageList.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          tokenCount: msg.tokenCount,
          createdAt: msg.createdAt.toISOString()
        }))
      })
    )
  } catch (error) {
    next(error)
  }
})

// 创建新对话
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.sub
    const { title, modelId } = req.body

    const [newConversation] = await db
      .insert(conversations)
      .values({
        userId,
        modelId,
        title: title || '新对话'
      })
      .returning()

    res.status(201).json(
      createSuccessResponse({
        id: newConversation.id,
        title: newConversation.title,
        modelId: newConversation.modelId,
        createdAt: newConversation.createdAt.toISOString(),
        updatedAt: newConversation.updatedAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

// 更新对话标题
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user!.sub
    const { title } = req.body

    // 检查对话是否存在且属于用户
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id))

    if (!conversation) {
      throw new NotFoundError('对话不存在')
    }

    if (conversation.userId !== userId) {
      throw new AuthorizationError('无权修改此对话')
    }

    const [updatedConversation] = await db
      .update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning()

    res.json(
      createSuccessResponse({
        id: updatedConversation.id,
        title: updatedConversation.title,
        updatedAt: updatedConversation.updatedAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

// 删除对话
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user!.sub

    // 检查对话是否存在且属于用户
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id))

    if (!conversation) {
      throw new NotFoundError('对话不存在')
    }

    if (conversation.userId !== userId) {
      throw new AuthorizationError('无权删除此对话')
    }

    // 先删除消息
    await db.delete(messages).where(eq(messages.conversationId, id))

    // 再删除对话
    await db.delete(conversations).where(eq(conversations.id, id))

    res.json(createSuccessResponse({ deleted: true }))
  } catch (error) {
    next(error)
  }
})

// 添加消息到对话
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user!.sub
    const { role, content } = req.body

    // 检查对话是否存在且属于用户
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id))

    if (!conversation) {
      throw new NotFoundError('对话不存在')
    }

    if (conversation.userId !== userId) {
      throw new AuthorizationError('无权向此对话添加消息')
    }

    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId: id,
        role,
        content
      })
      .returning()

    // 更新对话的更新时间
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id))

    res.status(201).json(
      createSuccessResponse({
        id: newMessage.id,
        role: newMessage.role,
        content: newMessage.content,
        createdAt: newMessage.createdAt.toISOString()
      })
    )
  } catch (error) {
    next(error)
  }
})

export default router
