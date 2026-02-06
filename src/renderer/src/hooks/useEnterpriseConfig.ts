import { useEffect, useState } from 'react'

export interface EnterpriseConfig {
  serverUrl: string | null
  feishuAppId: string | null
}

export function useEnterpriseConfig() {
  const [config, setConfig] = useState<EnterpriseConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Priority 2: Build-time environment variables (compiled into the app)
    const builtInConfig: EnterpriseConfig = {
      serverUrl: import.meta.env.VITE_ENTERPRISE_SERVER_URL || null,
      feishuAppId: import.meta.env.VITE_FEISHU_APP_ID || null
    }

    // Priority 1: External config file (~/.cherrystudio/config/enterprise.json)
    // This allows IT admins to override built-in values
    window.api.enterprise
      .getConfig()
      .then((fileConfig: EnterpriseConfig) => {
        setConfig({
          serverUrl: fileConfig.serverUrl || builtInConfig.serverUrl,
          feishuAppId: fileConfig.feishuAppId || builtInConfig.feishuAppId
        })
        setLoading(false)
      })
      .catch(() => {
        // If IPC fails, use built-in config
        setConfig(builtInConfig)
        setLoading(false)
      })
  }, [])

  return { config, loading }
}
