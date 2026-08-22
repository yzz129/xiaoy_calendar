# 小Y日历微信小程序

这是现有微信小程序 AppID 的“小Y日历”原生工程，不使用 `web-view`。原因是该 AppID 为个人主体，个人主体不能发布包含 `web-view` 的小程序。

## 已替换内容

- AppID：`wxfb514417ee21e094`
- 项目名称与页面名称：小Y日历
- 图标：`assets/app-icon.png`
- API 域名：`https://calendar.yzzwnw.asia`
- 代码：原生小程序登录、注册、月历、每日状态、工期、便签、规划、云端同步、账号与隐私页面
- 原工程的名称、域名和页面代码均已移除

## 微信后台必须同步修改

1. 在“设置 → 基本设置”将名称改为“小Y日历”，头像上传 `assets/app-icon.png`。
2. 在“开发管理 → 开发设置 → 服务器域名”把 request 合法域名改为 `https://calendar.yzzwnw.asia`。
3. 删除不再使用的旧 request、uploadFile 和 downloadFile 域名。
4. 服务类目应改成与日历/效率工具相符的类目；提交审核前同步更新《小程序用户隐私保护指引》。

个人主体不需要、也无法为本工程配置 `web-view` 业务域名。

## 导入与检查

在微信开发者工具中选择“导入项目”，目录选择本文件夹。代码上传前在仓库根目录运行：

```bash
npm run validate:miniprogram
```

开发者工具本地调试时可临时关闭域名校验，真机预览和提交审核前必须完成 request 合法域名配置。
