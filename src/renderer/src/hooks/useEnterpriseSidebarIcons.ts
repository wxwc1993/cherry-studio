import { ENTERPRISE_DISABLED_ICONS } from '@renderer/config/sidebar'
import { useAppSelector } from '@renderer/store'
import { selectIsEnterpriseMode } from '@renderer/store/enterprise'
import type { SidebarIcon } from '@renderer/types'
import { useMemo } from 'react'

/**
 * 企业版侧边栏图标过滤 Hook
 * 在企业模式下过滤掉禁用的侧边栏图标
 */
export function useEnterpriseSidebarIcons(visibleIcons: SidebarIcon[]): SidebarIcon[] {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)

  return useMemo(() => {
    if (!isEnterpriseMode) {
      return visibleIcons
    }

    // 过滤企业版禁用的图标
    return visibleIcons.filter((icon) => !ENTERPRISE_DISABLED_ICONS.includes(icon))
  }, [isEnterpriseMode, visibleIcons])
}
