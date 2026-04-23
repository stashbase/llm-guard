import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

const envFromDotenv = {
  ...config({ path: './.env' }).parsed,
  ...config({ path: './env' }).parsed,
}

const mergedEnv = {
  ...envFromDotenv,
  ...process.env,
}

const resolvedBaseUrl = mergedEnv.LLM_GUARD_BASE_URL ?? mergedEnv.DEV_API_URL ?? ''

export default defineConfig({
  define: {
    __SDK_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
    __SDK_DEV_API_URL__: JSON.stringify(resolvedBaseUrl),
  },
  test: {
    dir: 'tests',
    testTimeout: 10000,
    env: {
      ...mergedEnv,
      LLM_GUARD_BASE_URL: resolvedBaseUrl,
      DEV_API_URL: resolvedBaseUrl,
    },
  },
  server: {
    port: 3000,
  },
})
