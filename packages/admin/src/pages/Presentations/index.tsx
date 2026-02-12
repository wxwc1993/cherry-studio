import { BarChartOutlined, FileImageOutlined, FilePptOutlined, SettingOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'
import { useMemo } from 'react'

import { useAuthStore } from '../../store/auth'
import PresentationList from './PresentationList'
import PresentationSettings from './PresentationSettings'
import PresentationStatistics from './PresentationStatistics'
import TemplateManagement from './TemplateManagement'

export default function Presentations() {
  const { hasPermission } = useAuthStore()

  const tabItems = useMemo(() => {
    const items = [
      {
        key: 'list',
        label: (
          <span>
            <FilePptOutlined />
            PPT 列表
          </span>
        ),
        children: <PresentationList />
      },
      {
        key: 'templates',
        label: (
          <span>
            <FileImageOutlined />
            模板管理
          </span>
        ),
        children: <TemplateManagement />
      }
    ]

    if (hasPermission('presentations', 'admin')) {
      items.push(
        {
          key: 'statistics',
          label: (
            <span>
              <BarChartOutlined />
              使用统计
            </span>
          ),
          children: <PresentationStatistics />
        },
        {
          key: 'settings',
          label: (
            <span>
              <SettingOutlined />
              模块设置
            </span>
          ),
          children: <PresentationSettings />
        }
      )
    }

    return items
  }, [hasPermission])

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>演示文稿管理</h2>
      <Tabs defaultActiveKey="list" items={tabItems} />
    </div>
  )
}
