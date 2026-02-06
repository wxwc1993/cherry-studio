import { useAppSelector } from '@renderer/store'
import { selectIsEnterpriseMode } from '@renderer/store/enterprise'
import { type FC, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

interface EnterpriseMinAppGuardProps {
  children: ReactNode
}

/**
 * 企业版小程序路由守卫
 * 企业模式下禁止访问小程序页面，重定向到首页
 */
const EnterpriseMinAppGuard: FC<EnterpriseMinAppGuardProps> = ({ children }) => {
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)

  // 企业模式下不允许访问小程序
  if (isEnterpriseMode) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default EnterpriseMinAppGuard
