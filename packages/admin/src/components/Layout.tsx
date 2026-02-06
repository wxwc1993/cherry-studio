import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  CloudOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Dropdown, Layout as AntLayout, Menu, theme } from 'antd'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/auth'

const { Header, Sider, Content } = AntLayout

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, hasPermission } = useAuthStore()
  const { token } = theme.useToken()

  // 基于权限过滤菜单项
  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘'
      }
    ]

    // 组织管理菜单 - 需要 users read 权限
    if (hasPermission('users', 'read')) {
      const orgChildren = []
      orgChildren.push({ key: '/users', icon: <UserOutlined />, label: '用户管理' })
      orgChildren.push({ key: '/departments', icon: <TeamOutlined />, label: '部门管理' })
      if (hasPermission('users', 'admin')) {
        orgChildren.push({ key: '/roles', icon: <SafetyCertificateOutlined />, label: '角色权限' })
      }
      items.push({
        key: 'organization',
        icon: <TeamOutlined />,
        label: '组织管理',
        children: orgChildren
      })
    }

    // 模型管理 - 需要 models read 权限
    if (hasPermission('models', 'read')) {
      items.push({
        key: '/models',
        icon: <ApiOutlined />,
        label: '模型管理'
      })
    }

    // 知识库管理 - 需要 knowledgeBases read 权限
    if (hasPermission('knowledgeBases', 'read')) {
      items.push({
        key: '/knowledge-bases',
        icon: <BookOutlined />,
        label: '知识库管理'
      })
    }

    // 数据统计 - 需要 statistics read 权限
    if (hasPermission('statistics', 'read')) {
      items.push({
        key: '/statistics',
        icon: <BarChartOutlined />,
        label: '数据统计'
      })
    }

    // 备份管理 - 需要 system backup 权限
    if (hasPermission('system', 'backup')) {
      items.push({
        key: '/backups',
        icon: <CloudOutlined />,
        label: '备份管理'
      })
    }

    // 系统设置 - 需要 system settings 权限
    if (hasPermission('system', 'settings')) {
      items.push({
        key: '/settings',
        icon: <SettingOutlined />,
        label: '系统设置'
      })
    }

    return items
  }, [hasPermission])

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息'
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{
          borderRight: `1px solid ${token.colorBorderSecondary}`
        }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
          <span
            style={{
              fontSize: collapsed ? 16 : 18,
              fontWeight: 600,
              color: token.colorPrimary
            }}>
            {collapsed ? 'CS' : 'Cherry Studio'}
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['organization']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar src={user?.avatar} icon={<UserOutlined />} />
              <span>{user?.name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
            minHeight: 280
          }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
