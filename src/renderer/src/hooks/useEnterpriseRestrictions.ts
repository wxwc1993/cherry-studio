import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'

/**
 * 企业模式限制 Hook
 * 用于集中管理企业模式下的操作权限
 *
 * 企业模式激活条件：企业模式开启 && 已登录认证
 * 在此模式下，Provider 和 Model 的配置由管理员集中管理，用户无法修改
 */
export function useEnterpriseRestrictions() {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  // 企业模式激活 = 企业模式开启 && 已登录认证
  const isEnterpriseActive = isEnterpriseMode && isAuthenticated

  return {
    // 企业模式是否激活
    isEnterpriseActive,

    // Provider 相关权限
    canAddProvider: !isEnterpriseActive,
    canEditProvider: !isEnterpriseActive,
    canDeleteProvider: !isEnterpriseActive,
    canModifyProviderSettings: !isEnterpriseActive,

    // Model 相关权限
    canAddModel: !isEnterpriseActive,
    canEditModel: !isEnterpriseActive,
    canDeleteModel: !isEnterpriseActive
  }
}
