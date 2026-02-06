/**
 * Prometheus 指标模块
 *
 * 提供应用级别的监控指标，包括：
 * - HTTP 请求计数和延迟
 * - 模型 Token 用量
 * - 成本统计
 * - 活跃用户数
 */

// 简化版 Prometheus 指标实现
// 如需更完整功能，可安装 prom-client: pnpm add prom-client

export interface MetricLabels {
  [key: string]: string | number
}

interface CounterMetric {
  name: string
  help: string
  labels: string[]
  values: Map<string, number>
}

interface HistogramMetric {
  name: string
  help: string
  labels: string[]
  buckets: number[]
  values: Map<string, { sum: number; count: number; buckets: Map<number, number> }>
}

interface GaugeMetric {
  name: string
  help: string
  labels: string[]
  values: Map<string, number>
}

class MetricsRegistry {
  private counters: Map<string, CounterMetric> = new Map()
  private histograms: Map<string, HistogramMetric> = new Map()
  private gauges: Map<string, GaugeMetric> = new Map()

  createCounter(name: string, help: string, labels: string[] = []): Counter {
    const metric: CounterMetric = { name, help, labels, values: new Map() }
    this.counters.set(name, metric)
    return new Counter(metric)
  }

  createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets: number[] = [0.1, 0.5, 1, 2, 5]
  ): Histogram {
    const metric: HistogramMetric = { name, help, labels, buckets, values: new Map() }
    this.histograms.set(name, metric)
    return new Histogram(metric)
  }

  createGauge(name: string, help: string, labels: string[] = []): Gauge {
    const metric: GaugeMetric = { name, help, labels, values: new Map() }
    this.gauges.set(name, metric)
    return new Gauge(metric)
  }

  /**
   * 生成 Prometheus 格式的指标输出
   */
  async metrics(): Promise<string> {
    const lines: string[] = []

    // Counters
    for (const [, metric] of this.counters) {
      lines.push(`# HELP ${metric.name} ${metric.help}`)
      lines.push(`# TYPE ${metric.name} counter`)
      for (const [labelKey, value] of metric.values) {
        const labelStr = labelKey ? `{${labelKey}}` : ''
        lines.push(`${metric.name}${labelStr} ${value}`)
      }
    }

    // Histograms
    for (const [, metric] of this.histograms) {
      lines.push(`# HELP ${metric.name} ${metric.help}`)
      lines.push(`# TYPE ${metric.name} histogram`)
      for (const [labelKey, data] of metric.values) {
        const labelPrefix = labelKey ? `${labelKey},` : ''
        // Bucket values
        for (const bucket of metric.buckets) {
          const bucketValue = data.buckets.get(bucket) || 0
          lines.push(`${metric.name}_bucket{${labelPrefix}le="${bucket}"} ${bucketValue}`)
        }
        lines.push(`${metric.name}_bucket{${labelPrefix}le="+Inf"} ${data.count}`)
        lines.push(`${metric.name}_sum{${labelKey ? labelKey : ''}} ${data.sum}`)
        lines.push(`${metric.name}_count{${labelKey ? labelKey : ''}} ${data.count}`)
      }
    }

    // Gauges
    for (const [, metric] of this.gauges) {
      lines.push(`# HELP ${metric.name} ${metric.help}`)
      lines.push(`# TYPE ${metric.name} gauge`)
      for (const [labelKey, value] of metric.values) {
        const labelStr = labelKey ? `{${labelKey}}` : ''
        lines.push(`${metric.name}${labelStr} ${value}`)
      }
    }

    return lines.join('\n')
  }

  get contentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8'
  }
}

class Counter {
  constructor(private metric: CounterMetric) {}

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels)
    const current = this.metric.values.get(key) || 0
    this.metric.values.set(key, current + value)
  }

  private labelsToKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
  }
}

class Histogram {
  constructor(private metric: HistogramMetric) {}

  observe(labels: MetricLabels = {}, value: number): void {
    const key = this.labelsToKey(labels)
    let data = this.metric.values.get(key)
    if (!data) {
      data = { sum: 0, count: 0, buckets: new Map() }
      for (const bucket of this.metric.buckets) {
        data.buckets.set(bucket, 0)
      }
      this.metric.values.set(key, data)
    }

    data.sum += value
    data.count += 1

    // Update buckets
    for (const bucket of this.metric.buckets) {
      if (value <= bucket) {
        data.buckets.set(bucket, (data.buckets.get(bucket) || 0) + 1)
      }
    }
  }

  private labelsToKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
  }
}

class Gauge {
  constructor(private metric: GaugeMetric) {}

  set(labels: MetricLabels = {}, value: number): void {
    const key = this.labelsToKey(labels)
    this.metric.values.set(key, value)
  }

  inc(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels)
    const current = this.metric.values.get(key) || 0
    this.metric.values.set(key, current + value)
  }

  dec(labels: MetricLabels = {}, value: number = 1): void {
    const key = this.labelsToKey(labels)
    const current = this.metric.values.get(key) || 0
    this.metric.values.set(key, current - value)
  }

  private labelsToKey(labels: MetricLabels): string {
    return Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
  }
}

// 创建全局注册表
export const registry = new MetricsRegistry()

// ============ 预定义指标 ============

/**
 * HTTP 请求总数
 * Labels: method, path, status
 */
export const httpRequestsTotal = registry.createCounter('http_requests_total', 'Total HTTP requests', [
  'method',
  'path',
  'status'
])

/**
 * HTTP 请求延迟（秒）
 * Labels: method, path
 */
export const httpRequestDuration = registry.createHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  ['method', 'path'],
  [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
)

/**
 * 模型 Token 用量
 * Labels: model, type (input/output)
 */
export const modelTokensTotal = registry.createCounter('model_tokens_total', 'Total tokens used', ['model', 'type'])

/**
 * 模型调用成本（美元）
 * Labels: model
 */
export const modelCostTotal = registry.createCounter('model_cost_usd_total', 'Total cost in USD', ['model'])

/**
 * 活跃连接数
 */
export const activeConnections = registry.createGauge('active_connections', 'Number of active connections')

/**
 * 用户配额剩余
 * Labels: user_id
 */
export const userQuotaRemaining = registry.createGauge('user_quota_remaining', 'Remaining user quota', ['user_id'])

export { Counter, Gauge,Histogram }
