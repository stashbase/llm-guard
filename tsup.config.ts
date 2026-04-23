import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'tsup'

type PackageJson = {
  version?: string
}

const packageJson = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as PackageJson

const sdkVersion = packageJson.version ?? '0.0.0'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  define: {
    __SDK_VERSION__: JSON.stringify(sdkVersion),
    __SDK_DEV_API_URL__: JSON.stringify(''),
  },
})
