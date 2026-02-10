import './index.css'

import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import React from 'react'
import ReactDOM from 'react-dom/client'

import App from './App'
import { darkTheme, registerEChartsTheme } from './theme'

registerEChartsTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={darkTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
