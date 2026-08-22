import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve('wechat-miniprogram')
const required = [
  'project.config.json', 'app.json', 'app.js', 'app.wxss', 'sitemap.json', 'README.md',
  'assets/app-icon.png', 'utils/api.js', 'utils/date.js',
  'pages/login/login.js', 'pages/login/login.json', 'pages/login/login.wxml', 'pages/login/login.wxss',
  'pages/calendar/calendar.js', 'pages/calendar/calendar.json', 'pages/calendar/calendar.wxml', 'pages/calendar/calendar.wxss',
  'pages/day/day.js', 'pages/day/day.json', 'pages/day/day.wxml', 'pages/day/day.wxss',
  'pages/plans/plans.js', 'pages/plans/plans.json', 'pages/plans/plans.wxml', 'pages/plans/plans.wxss',
  'pages/profile/profile.js', 'pages/profile/profile.json', 'pages/profile/profile.wxml', 'pages/profile/profile.wxss',
  'pages/privacy/privacy.js', 'pages/privacy/privacy.json', 'pages/privacy/privacy.wxml', 'pages/privacy/privacy.wxss',
]

for (const file of required) statSync(resolve(root, file))

for (const file of ['project.config.json', 'app.json', 'sitemap.json']) {
  JSON.parse(readFileSync(resolve(root, file), 'utf8'))
}

const project = JSON.parse(readFileSync(resolve(root, 'project.config.json'), 'utf8'))
if (project.appid !== 'wxfb514417ee21e094') throw new Error('微信小程序 AppID 不正确')
if (project.projectname !== '小Y日历') throw new Error('微信小程序名称未切换为小Y日历')

const allText = required
  .filter((file) => !file.endsWith('.png'))
  .map((file) => readFileSync(resolve(root, file), 'utf8'))
  .join('\n')
if (/小Y壁纸|tea\.qingnian8\.com/.test(allText)) throw new Error('仍存在旧小程序名称或域名')
if (!allText.includes('https://calendar.yzzwnw.asia')) throw new Error('未配置小Y日历 API 域名')

const allowedWxmlTags = new Set(['view', 'text', 'image', 'button', 'navigator', 'input', 'label', 'picker'])
for (const file of required.filter((item) => item.endsWith('.wxml'))) {
  const markup = readFileSync(resolve(root, file), 'utf8')
  const tags = [...markup.matchAll(/<\/?([a-zA-Z][\w-]*)/g)].map((match) => match[1])
  const invalid = [...new Set(tags.filter((tag) => !allowedWxmlTags.has(tag)))]
  if (invalid.length) throw new Error(`${file} 存在非小程序组件标签：${invalid.join(', ')}`)
}

for (const file of required.filter((file) => file.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'inherit' })
}

console.log(`微信小程序工程校验通过：${required.length} 个关键文件`) // eslint-disable-line no-console
