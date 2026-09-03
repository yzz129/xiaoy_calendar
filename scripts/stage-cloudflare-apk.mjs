import { copyFile, mkdir, open, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.XIAOY_APK_PATH || resolve(repoRoot, 'release/xiaoy-calendar-1.9-store.apk'))
const destination = resolve(repoRoot, 'dist/downloads/xiaoy-calendar-latest.apk')
const versionedDestination = resolve(repoRoot, 'dist/downloads/xiaoy-calendar-1.9-109005.apk')
const pagesAssetLimit = 25 * 1024 * 1024

const sourceInfo = await stat(source)
if (!sourceInfo.isFile()) throw new Error(`APK source is not a file: ${source}`)
if (sourceInfo.size > pagesAssetLimit) {
  throw new Error(`APK exceeds Cloudflare Pages' 25 MiB asset limit: ${sourceInfo.size} bytes`)
}

const handle = await open(source, 'r')
try {
  const signature = Buffer.alloc(2)
  await handle.read(signature, 0, signature.length, 0)
  if (signature.toString('ascii') !== 'PK') throw new Error(`APK is not a ZIP archive: ${source}`)
} finally {
  await handle.close()
}

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
await copyFile(source, versionedDestination)
console.log(`Staged Cloudflare APK: ${sourceInfo.size} bytes -> ${destination}`)
