import { Avatar } from 'antd'
import { useMemo } from 'react'

import { getProviderLogoUrl } from '@/config/providerLogos'

interface ProviderLogoProps {
  providerId: string
  providerName?: string
  size?: number
}

/**
 * 简单的哈希函数，用于根据 providerId 生成稳定的背景色
 */
function hashStringToColor(str: string): string {
  const colors = [
    '#1677ff',
    '#52c41a',
    '#faad14',
    '#ff4d4f',
    '#722ed1',
    '#13c2c2',
    '#eb2f96',
    '#fa8c16',
    '#2f54eb',
    '#a0d911'
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % colors.length
  return colors[index]
}

/**
 * 供应商图标组件
 *
 * 优先显示供应商对应的图标，无图标时回退为带背景色的首字母头像。
 */
export default function ProviderLogo({ providerId, providerName, size = 20 }: ProviderLogoProps) {
  const logoUrl = useMemo(() => getProviderLogoUrl(providerId), [providerId])

  if (logoUrl) {
    return <Avatar src={logoUrl} size={size} shape="square" style={{ flexShrink: 0, borderRadius: 4 }} />
  }

  const displayChar = (providerName || providerId).charAt(0).toUpperCase()
  const bgColor = hashStringToColor(providerId)

  return (
    <Avatar
      size={size}
      shape="square"
      style={{
        flexShrink: 0,
        borderRadius: 4,
        backgroundColor: bgColor,
        fontSize: Math.round(size * 0.5),
        lineHeight: `${size}px`
      }}>
      {displayChar}
    </Avatar>
  )
}
