import type { ThemeConfig } from 'antd'

export const darkTheme: ThemeConfig = {
  token: {
    // Colors
    colorPrimary: '#6366f1',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#06b6d4',
    colorLink: '#6366f1',
    colorTextBase: '#e0e8ff',
    colorBgBase: '#0a0e1a',
    colorBgContainer: '#111827',
    colorBgElevated: '#1f2937',
    colorBgLayout: '#0a0e1a',
    colorBorder: '#1e293b',
    colorBorderSecondary: 'rgba(255,255,255,0.06)',
    // Typography
    fontFamily: "'DM Sans', 'Noto Sans SC', system-ui, -apple-system, sans-serif",
    fontFamilyCode: "'Fira Code', monospace",
    fontSize: 14,
    // Border radius
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    // Shadows
    boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    boxShadowSecondary: '0 2px 12px rgba(0,0,0,0.2)',
    // Spacing
    controlHeight: 36
  },
  components: {
    Layout: {
      siderBg: '#111827',
      headerBg: '#111827',
      bodyBg: '#0a0e1a',
      triggerBg: '#1f2937'
    },
    Menu: {
      darkItemBg: '#111827',
      darkSubMenuItemBg: '#0f1729',
      darkItemSelectedBg: 'rgba(99,102,241,0.15)',
      darkItemHoverBg: 'rgba(99,102,241,0.08)',
      darkItemSelectedColor: '#818cf8',
      darkItemColor: '#94a3b8',
      darkItemHoverColor: '#e0e8ff'
    },
    Card: {
      colorBgContainer: 'rgba(17,24,39,0.8)',
      colorBorderSecondary: 'rgba(255,255,255,0.06)'
    },
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#1f2937',
      headerColor: '#94a3b8',
      rowHoverBg: 'rgba(99,102,241,0.06)',
      borderColor: '#1e293b'
    },
    Input: {
      colorBgContainer: '#1f2937',
      colorBorder: '#1e293b',
      activeBorderColor: '#6366f1',
      hoverBorderColor: '#374151'
    },
    Select: {
      colorBgContainer: '#1f2937',
      colorBgElevated: '#1f2937',
      optionSelectedBg: 'rgba(99,102,241,0.15)'
    },
    Modal: {
      contentBg: '#111827',
      headerBg: '#111827'
    },
    Tabs: {
      inkBarColor: '#6366f1',
      itemSelectedColor: '#e0e8ff',
      itemColor: '#94a3b8',
      itemHoverColor: '#818cf8'
    },
    Button: {
      primaryShadow: '0 2px 8px rgba(99,102,241,0.3)'
    },
    Tag: {
      defaultBg: '#1f2937',
      defaultColor: '#94a3b8'
    },
    Statistic: {
      // Colors inherited from global colorTextBase / colorTextSecondary
    },
    DatePicker: {
      colorBgContainer: '#1f2937',
      colorBgElevated: '#1f2937'
    },
    Dropdown: {
      colorBgElevated: '#1f2937'
    },
    Popconfirm: {
      colorBgElevated: '#1f2937'
    },
    Tree: {
      nodeSelectedBg: 'rgba(99,102,241,0.15)',
      nodeHoverBg: 'rgba(99,102,241,0.06)'
    },
    Form: {
      labelColor: '#94a3b8'
    }
  }
}
