import { Tabs } from 'antd'

import BannerManager from './BannerManager'
import CourseManager from './CourseManager'
import DocumentManager from './DocumentManager'
import HotItemManager from './HotItemManager'

export default function LearningCenter() {
  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>学习中心管理</h2>
      <Tabs
        defaultActiveKey="banners"
        items={[
          { key: 'banners', label: 'Banner 管理', children: <BannerManager /> },
          { key: 'courses', label: '视频课程', children: <CourseManager /> },
          { key: 'documents', label: '知识文档', children: <DocumentManager /> },
          { key: 'hotItems', label: '热搜要闻', children: <HotItemManager /> }
        ]}
      />
    </div>
  )
}
