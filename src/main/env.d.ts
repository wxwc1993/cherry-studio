/// <reference types="vite/client" />

interface ImportMetaEnv {
  VITE_MAIN_BUNDLE_ID: string
  readonly VITE_ENTERPRISE_SERVER_URL?: string
  readonly VITE_FEISHU_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
