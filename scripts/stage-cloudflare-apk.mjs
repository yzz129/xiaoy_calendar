import { copyFile, mkdir, open, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.XIAOY_APK_PATH || resolve(repoRoot, 'release/xiaoy-calendar-1.5-store.apk'))
const destination = resolve(repoRoot, 'dist/downloads/xiaoy-calendar-latest.apk')
const pagesAssetLimit = 25 * 1024 * 1024
const wechatVerificationFile = resolve(repoRoot, 'dist/3848ceb297f8b0a459436cb065b6c643.txt')
const wechatVerificationToken = '836514ef74ccac7b333da87cea04aaf574c49c39'

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
await writeFile(wechatVerificationFile, Buffer.from(wechatVerificationToken, 'ascii'))
console.log(`Staged Cloudflare APK: ${sourceInfo.size} bytes -> ${destination}`)
console.log(`Staged WeChat verification file: ${wechatVerificationToken.length} bytes -> ${wechatVerificationFile}`)
