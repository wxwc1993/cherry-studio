import { config } from '../config'
import { createLogger } from '../utils/logger'

const logger = createLogger('FeishuAlertService')

export type AlertLevel = 'info' | 'warning' | 'error'

interface FeishuCardMessage {
  msg_type: 'interactive'
  card: {
    header: {
      title: { tag: 'plain_text'; content: string }
      template: string
    }
    elements: Array<{
      tag: 'div'
      text: { tag: 'plain_text' | 'lark_md'; content: string }
    }>
  }
}

/**
 * 飞书告警服务
 * 通过 Webhook 发送告警消息到飞书群
 */
class FeishuAlertService {
  private webhookUrl: string
  private enabled: boolean

  private readonly colorMap: Record<AlertLevel, string> = {
    info: 'blue',
    warning: 'yellow',
    error: 'red'
  }

  private readonly levelLabels: Record<AlertLevel, string> = {
    info: '信息',
    warning: '警告',
    error: '错误'
  }

  constructor() {
    this.webhookUrl = config.feishuAlert.webhookUrl
    this.enabled = config.feishuAlert.enabled
  }

  /**
   * 发送告警消息
   * @param title 告警标题
   * @param content 告警内容
   * @param level 告警级别
   */
  async send(title: string, content: string, level: AlertLevel = 'info'): Promise<boolean> {
    if (!this.enabled) {
      logger.debug({ title, level }, 'Feishu alert disabled, skipping')
      return false
    }

    if (!this.webhookUrl) {
      logger.warn('Feishu webhook URL not configured')
      return false
    }

    const message: FeishuCardMessage = {
      msg_type: 'interactive',
      card: {
        header: {
          title: {
            tag: 'plain_text',
            content: `[${this.levelLabels[level]}] ${title}`
          },
          template: this.colorMap[level]
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content
            }
          }
        ]
      }
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ status: response.status, error: errorText }, 'Failed to send Feishu alert')
        return false
      }

      const result = (await response.json()) as { code?: number; msg?: string }
      if (result.code !== 0) {
        logger.error({ result }, 'Feishu API returned error')
        return false
      }

      logger.info({ title, level }, 'Feishu alert sent successfully')
      return true
    } catch (error) {
      logger.error({ error, title }, 'Error sending Feishu alert')
      return false
    }
  }

  /**
   * 发送给用户的配额预警
   */
  async sendQuotaWarning(userId: string, userName: string, usedPercent: number): Promise<boolean> {
    const content = `**用户**: ${userName}\n**用户ID**: ${userId}\n**配额使用率**: ${usedPercent.toFixed(1)}%\n\n请注意控制 AI 使用量，或联系管理员增加配额。`
    return this.send('配额预警', content, usedPercent >= 95 ? 'error' : 'warning')
  }

  /**
   * 发送给管理员的配额预警
   */
  async sendQuotaExhaustedToAdmin(userId: string, userName: string, usedPercent: number): Promise<boolean> {
    const content = `**用户**: ${userName}\n**用户ID**: ${userId}\n**配额使用率**: ${usedPercent.toFixed(1)}%\n\n用户配额即将耗尽或已耗尽，请及时处理。`
    return this.send('用户配额告警', content, 'error')
  }

  /**
   * 发送系统错误告警
   */
  async sendSystemError(errorType: string, errorMessage: string, details?: string): Promise<boolean> {
    let content = `**错误类型**: ${errorType}\n**错误信息**: ${errorMessage}`
    if (details) {
      content += `\n**详情**:\n\`\`\`\n${details}\n\`\`\``
    }
    return this.send('系统错误', content, 'error')
  }

  /**
   * 发送备份状态通知
   */
  async sendBackupStatus(status: 'success' | 'failed', backupType: string, details?: string): Promise<boolean> {
    const level: AlertLevel = status === 'success' ? 'info' : 'error'
    const title = status === 'success' ? '备份成功' : '备份失败'
    let content = `**备份类型**: ${backupType}\n**状态**: ${status === 'success' ? '成功' : '失败'}`
    if (details) {
      content += `\n**详情**: ${details}`
    }
    return this.send(title, content, level)
  }

  /**
   * 处理 AlertManager webhook
   * 将 Prometheus 告警转发到飞书
   */
  async handleAlertManagerWebhook(payload: AlertManagerPayload): Promise<boolean> {
    const alerts = payload.alerts || []
    if (alerts.length === 0) {
      return true
    }

    for (const alert of alerts) {
      const status = alert.status === 'resolved' ? '已恢复' : '告警中'
      const level: AlertLevel =
        alert.status === 'resolved' ? 'info' : alert.labels?.severity === 'critical' ? 'error' : 'warning'

      const content = [
        `**状态**: ${status}`,
        `**告警名称**: ${alert.labels?.alertname || 'Unknown'}`,
        `**严重程度**: ${alert.labels?.severity || 'unknown'}`,
        `**摘要**: ${alert.annotations?.summary || 'N/A'}`,
        `**描述**: ${alert.annotations?.description || 'N/A'}`,
        `**开始时间**: ${alert.startsAt || 'N/A'}`
      ].join('\n')

      await this.send(`Prometheus 告警: ${alert.labels?.alertname || 'Unknown'}`, content, level)
    }

    return true
  }
}

// AlertManager payload types
interface AlertManagerPayload {
  status: 'firing' | 'resolved'
  alerts: Array<{
    status: 'firing' | 'resolved'
    labels?: Record<string, string>
    annotations?: Record<string, string>
    startsAt?: string
    endsAt?: string
  }>
}

// 导出单例
export const feishuAlertService = new FeishuAlertService()
