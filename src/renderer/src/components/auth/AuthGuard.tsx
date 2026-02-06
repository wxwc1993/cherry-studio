import { useAppSelector } from '@renderer/store'
import { selectIsAuthenticated, selectIsEnterpriseMode } from '@renderer/store/enterprise'
import { type FC } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

/**
 * 认证守卫组件
 * 用于保护需要认证的路由，未认证时重定向到企业版登录页面
 */
const AuthGuard: FC = () => {
  const location = useLocation()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isEnterpriseMode = useAppSelector(selectIsEnterpriseMode)

  // 企业模式下，未认证则重定向到登录页
  if (isEnterpriseMode && !isAuthenticated) {
    return <Navigate to="/login/enterprise" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default AuthGuard
