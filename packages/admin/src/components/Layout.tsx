import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  CloudOutlined,
  DashboardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Avatar, Button, Dropdown, Layout as AntLayout, Menu } from 'antd'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuthStore } from '../store/auth'

const { Header, Sider, Content } = AntLayout

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, hasPermission } = useAuthStore()

  const menuItems: MenuProps['items'] = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘'
      }
    ]

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

    if (hasPermission('models', 'read')) {
      items.push({
        key: '/models',
        icon: <ApiOutlined />,
        label: '模型管理'
      })
    }

    if (hasPermission('knowledgeBases', 'read')) {
      items.push({
        key: '/knowledge-bases',
        icon: <BookOutlined />,
        label: '知识库管理'
      })
    }

    if (hasPermission('assistantPresets', 'read')) {
      items.push({
        key: '/assistant-presets',
        icon: <RobotOutlined />,
        label: '提示词助手'
      })
    }

    if (hasPermission('statistics', 'read')) {
      items.push({
        key: '/statistics',
        icon: <BarChartOutlined />,
        label: '数据统计'
      })
    }

    if (hasPermission('system', 'backup')) {
      items.push({
        key: '/backups',
        icon: <CloudOutlined />,
        label: '备份管理'
      })
    }

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
        theme="dark"
        style={{
          background: 'var(--cs-bg-1)',
          borderRight: '1px solid var(--cs-border)'
        }}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid transparent',
            borderImage: 'linear-gradient(90deg, transparent, var(--cs-primary), transparent) 1',
            position: 'relative'
          }}>
          <span
            className="gradient-text"
            style={{
              fontSize: collapsed ? 16 : 18,
              fontWeight: 700,
              fontFamily: 'var(--cs-font-heading)',
              letterSpacing: '-0.02em'
            }}>
            {collapsed ? 'CS' : 'Cherry Studio'}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['organization']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, background: 'transparent' }}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: 'rgba(17,24,39,0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid transparent',
            borderImage: 'linear-gradient(90deg, transparent, var(--cs-border), transparent) 1'
          }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: 'var(--cs-text-2)' }}
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar
                src={user?.avatar}
                icon={<UserOutlined />}
                style={{
                  boxShadow: '0 0 0 2px rgba(99,102,241,0.3)',
                  border: '2px solid var(--cs-bg-2)'
                }}
              />
              <span style={{ color: 'var(--cs-text-1)' }}>{user?.name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: 'transparent',
            minHeight: 280,
            backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%)'
          }}>
          <div className="fade-in">
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}
