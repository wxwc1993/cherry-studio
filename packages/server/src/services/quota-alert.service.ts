import { createLogger } from '../utils/logger'
import { feishuAlertService } from './feishu-alert.service'

const logger = createLogger('QuotaAlertService')

/**
 * 配额预警阈值配置
 */
const THRESHOLDS = [
  { percent: 80, notifyUser: true, notifyAdmin: false },
  { percent: 95, notifyUser: true, notifyAdmin: true },
  { percent: 100, notifyUser: true, notifyAdmin: true }
] as const

/**
 * 记录已发送的预警，避免重复发送
 * Key: `${userId}:${thresholdPercent}`
 * Value: 发送时间戳
 */
const sentAlerts = new Map<string, number>()

/**
 * 预警冷却时间（毫秒）
 * 同一阈值的预警在冷却时间内不会重复发送
 */
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 小时

/**
 * 配额预警服务
 * 检查用户配额使用情况并发送预警通知
 */
class QuotaAlertService {
  /**
   * 检查配额并发送预警
   * @param userId 用户 ID
   * @param userName 用户名称
   * @param usedPercent 已使用百分比 (0-100+)
   * @returns 是否发送了预警
   */
  async checkAndNotify(userId: string, userName: string, usedPercent: number): Promise<boolean> {
    // 从高到低检查阈值
    for (const threshold of [...THRESHOLDS].reverse()) {
      if (usedPercent >= threshold.percent) {
        const alertKey = `${userId}:${threshold.percent}`

        // 检查冷却时间
        if (this.isInCooldown(alertKey)) {
          logger.debug({ userId, threshold: threshold.percent }, 'Quota alert in cooldown, skipping')
          return false
        }

        // 发送预警
        let sent = false

        if (threshold.notifyUser) {
          const userSent = await feishuAlertService.sendQuotaWarning(userId, userName, usedPercent)
          sent = sent || userSent
        }

        if (threshold.notifyAdmin) {
          const adminSent = await feishuAlertService.sendQuotaExhaustedToAdmin(userId, userName, usedPercent)
          sent = sent || adminSent
        }

        if (sent) {
          // 记录发送时间
          sentAlerts.set(alertKey, Date.now())
          logger.info({ userId, threshold: threshold.percent, usedPercent }, 'Quota alert sent')
        }

        return sent
      }
    }

    return false
  }

  /**
   * 检查配额是否超限
   * @param remaining 剩余配额
   * @param total 总配额
   * @returns 是否超限
   */
  isQuotaExceeded(remaining: number, _total: number): boolean {
    return remaining <= 0
  }

  /**
   * 计算使用百分比
   * @param used 已使用量
   * @param total 总量
   * @returns 使用百分比
   */
  calculateUsedPercent(used: number, total: number): number {
    if (total <= 0) return 100
    return (used / total) * 100
  }

  /**
   * 检查是否在冷却时间内
   */
  private isInCooldown(alertKey: string): boolean {
    const lastSent = sentAlerts.get(alertKey)
    if (!lastSent) return false
    return Date.now() - lastSent < ALERT_COOLDOWN_MS
  }

  /**
   * 清理过期的预警记录
   * 应定期调用以防止内存泄漏
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, timestamp] of sentAlerts) {
      if (now - timestamp > ALERT_COOLDOWN_MS) {
        sentAlerts.delete(key)
      }
    }
  }

  /**
   * 重置预警状态（用于测试）
   */
  reset(): void {
    sentAlerts.clear()
  }
}

// 导出单例
export const quotaAlertService = new QuotaAlertService()

// 定期清理过期记录（每小时）
setInterval(
  () => {
    quotaAlertService.cleanup()
  },
  60 * 60 * 1000
)
