import * as echarts from 'echarts/core'

const ECHARTS_THEME_NAME = 'cherryDark'

const cherryDarkTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#94a3b8' },
  title: {
    textStyle: { color: '#e0e8ff' },
    subtextStyle: { color: '#94a3b8' }
  },
  legend: { textStyle: { color: '#94a3b8' } },
  tooltip: {
    backgroundColor: 'rgba(17,24,39,0.95)',
    borderColor: 'rgba(255,255,255,0.06)',
    textStyle: { color: '#e0e8ff' },
    extraCssText: 'backdrop-filter: blur(12px); border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);'
  },
  color: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'],
  categoryAxis: {
    axisLine: { lineStyle: { color: '#1e293b' } },
    axisTick: { lineStyle: { color: '#1e293b' } },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#1e293b' } },
    axisTick: { lineStyle: { color: '#1e293b' } },
    axisLabel: { color: '#64748b' },
    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }
  },
  bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
  line: { smooth: true, symbol: 'circle', symbolSize: 6 },
  pie: { itemStyle: { borderColor: '#111827', borderWidth: 2 } }
}

export function registerEChartsTheme() {
  echarts.registerTheme(ECHARTS_THEME_NAME, cherryDarkTheme)
}

export { ECHARTS_THEME_NAME }
