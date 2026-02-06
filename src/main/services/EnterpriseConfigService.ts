import * as fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { HOME_CHERRY_DIR } from '@shared/config/constant'

export interface EnterpriseConfig {
  serverUrl: string | null
  feishuAppId: string | null
}

function getEnterpriseConfigPath(): string {
  return path.join(os.homedir(), HOME_CHERRY_DIR, 'config', 'enterprise.json')
}

function readConfigFromFile(): Partial<EnterpriseConfig> {
  try {
    const configPath = getEnterpriseConfigPath()
    if (!fs.existsSync(configPath)) {
      return {}
    }
    const content = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

export function getEnterpriseConfig(): EnterpriseConfig {
  const fileConfig = readConfigFromFile()

  // Only return values from external config file
  // Build-time environment variables are handled in the renderer process
  // via import.meta.env which Vite replaces at build time
  return {
    serverUrl: fileConfig.serverUrl || null,
    feishuAppId: fileConfig.feishuAppId || null
  }
}
