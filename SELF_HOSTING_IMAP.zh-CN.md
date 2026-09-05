# Zero Fork：IMAP / SMTP、BYOK 和移动端构建说明

> **状态：实验性第一版，不是完成全部目标的生产发行版。**
> 当前仓库实际采用 React Router / Vite 前端和 Cloudflare Workers / Durable Objects 后端，不是一个普通 Next.js + Node 服务。
> 本改造已提交到 `feat/imap-byok-mobile` 分支，包含 Node IMAP 桥接服务源码、Zero 内的 `/imap` 页面、用户自有 AI API 设置、Docker 配置和 Capacitor 打包脚手架。
> **桥接服务可以用 Docker 部署，但整个 Zero 尚未迁移为纯 Docker；移动端尚未实现原生认证、推送和离线同步。**

## 1. 本次实现与边界

| 项目 | 实现情况 |
| --- | --- |
| QQ / 163 / 126 / iCloud / 自定义 IMAP | 预设、IMAPS 993、SMTP 465 或强制 STARTTLS 587；自定义主机需管理员允许 |
| 账号安全 | IMAP 和 SMTP 验证成功后才保存；AES-256-GCM 加密存储；记录绑定 Zero 用户 ID；断开时删除授权码 |
| 读取邮件 | 文件夹发现、UID + UIDVALIDITY 标识、UID 游标分页、普通文本搜索、MIME 正文和附件 |
| 写入操作 | 已读 / 星标、原子 MOVE（服务商不支持则明确报错）、立即 SMTP 发送、可选已发送副本 |
| 发信重复保护 | 客户端稳定 operationId + 持久化发送记录；结果不明不会自动重发。不是 SMTP 全局 exactly-once 保证 |
| AI | 每个用户配置 Base URL、Key、模型；支持 Chat Completions 兼容接口；摘要、回复草拟、翻译。用户明确同意后才发送所选邮件内容 |
| Web 工作区 | `/imap`；复用 Zero 的登录认证，独立内存查询缓存，不把本工作区邮件正文持久化到 IndexedDB |
| Gmail / Outlook | 原路径不变；本版 **尚未** 将 IMAP 邮件合并到原有分片收件箱，也未替换上游所有 AI 功能 |
| iOS / Android | Capacitor 8 静态资源复制与平台创建配置；**仅构建脚手架，不是已验证可日用 App** |
| 尚未实现 | 后台 IDLE 同步引擎、MODSEQ / QRESYNC、推送、离线缓存、会话聚合、服务器草稿、发送撤回、定时发送、Tauri 桌面壳 |

每封 IMAP 邮件暂按一个会话返回，保留 Message-ID / References 供后续聚合。前台页面约每 60 秒刷新列表，进入后台不保证继续刷新。搜索限定当前文件夹，不支持 Gmail 专属查询语法。

账号仍使用 Zero 已有的登录方式认证；QQ/163 邮箱账号不是新增的 Zero 登录方式。本版不能承诺“只有 QQ 邮箱，不配置原有认证，也能完成首次部署”。

## 2. 目录

```text
integrations/imap-bridge/       # 独立 Node 服务，不改变根 pnpm workspace / lockfile
  src/core.mjs                 # 加密、校验、UID、发件记录
  src/mail.mjs                 # IMAPFlow + Nodemailer + MIME 处理
  src/server.mjs               # 鉴权 RPC、账号和 AI 设置
  compose.yaml
apps/server/src/lib/imap-bridge.ts
apps/server/src/trpc/routes/imap.ts
apps/mail/app/imap/page.tsx
native/mobile/                # 独立 npm Capacitor 构建脚手架
```

## 3. 部署前提

桥接服务需要 Docker Engine + Compose v2；生成配置脚本和本地测试需要 Node.js 22.12+。整个 Zero 的开发还需要仓库指定的 pnpm 10.15.0。

**务必区分两部分：**

- 已经能够启动、登录的 Zero：按下文添加桥接服务、Worker 变量、重新构建，即可开始本版的集成验收。
- 全新机器、从未成功运行 Zero：还需要完成上游的 PostgreSQL、认证、Cloudflare Durable Objects / KV / Queues / R2 / Hyperdrive 等初始化。`apps/server/wrangler.jsonc` 带有上游资源标识，不能把它们当作自己已经拥有的资源。本文未把这部分伪装为“一条 Compose 命令即可运行”。

不要把 `wrangler dev` 长期暴露到公网当生产后端，也不要直接执行旧回复中未经核验的 `pnpm start` systemd 配置。

## 4. 获取改造分支

```bash
git clone --branch feat/imap-byok-mobile https://github.com/Tippye/Zero.git
cd Zero
```

已有本地克隆时，先确认工作区没有未提交修改，再切换：

```bash
git fetch origin
git switch --track origin/feat/imap-byok-mobile
```

## 5. 启动 IMAP 桥接容器

在仓库根目录执行：

```bash
cd integrations/imap-bridge
node scripts/init-env.mjs
chmod 600 .env
```

脚本用系统随机数创建 `BRIDGE_SECRET` 和 `BRIDGE_ENCRYPTION_KEY`，不会打印它们，也不会覆盖已有 `.env`。**加密 Key 丢失后，旧存储无法解密；不能随意重新生成。**

编辑 `.env`：

```dotenv
# 两个密钥保留脚本生成的值。
BRIDGE_SECRET=...
BRIDGE_ENCRYPTION_KEY=...
BRIDGE_PORT=3033

# QQ/163/126/iCloud 预设不用填这里；其他服务商需精确主机白名单。
BRIDGE_ALLOWED_MAIL_HOSTS=imap.example.com,smtp.example.com

# 填精确 origin，不带 /v1；多个以英文逗号分隔。
BRIDGE_ALLOWED_AI_ORIGINS=https://llm.example.com
```

启动并查看状态：

```bash
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3033/healthz
```

成功应返回 `{"status":"ok"}`。这只代表服务进程启动，**不代表已经连通 QQ/163 或 AI**。

默认端口只绑定 `127.0.0.1`，数据在 `bridge-data` 命名卷，进程以非 root 运行。**每个数据卷只允许一个桥接进程，不要横向扩容共享此卷。**

### 对远端 Cloudflare Worker 提供 HTTPS

Worker 不能访问你的 VPS 的 `127.0.0.1`。需要一个可达的 HTTPS 域名，例如 `bridge.example.com`，反代到宿主机 `127.0.0.1:3033`。

宿主机上已有 Caddy 时，合并 `Caddyfile.example` 中的站点块，替换域名并验证 DNS、80/443、防火墙。不要覆盖现有 Caddy 站点配置。使用自己现有的反代也可以。

`/rpc` 每次必须带服务端共享 Bearer Key；不要将这个 Key 放进浏览器、手机包、`VITE_PUBLIC_*`、URL 查询字符串或日志。**这不是面向匿名客户端的公共 API。**

## 6. 连接 Zero 后端

给实际运行 Zero 的 Worker 环境添加以下两个服务器变量：

```dotenv
IMAP_BRIDGE_URL=https://bridge.example.com
IMAP_BRIDGE_SECRET=与桥接容器的BRIDGE_SECRET一致
```

例如在已经完成上游资源配置、使用 Wrangler 默认环境的部署中：

```bash
# 在仓库根目录安装依赖。
pnpm install --frozen-lockfile

cd apps/server
pnpm exec wrangler secret put IMAP_BRIDGE_URL
pnpm exec wrangler secret put IMAP_BRIDGE_SECRET
pnpm exec wrangler deploy
```

每条 `secret put` 按交互提示输入对应值。使用命名环境时，**三条 Wrangler 命令必须使用同一个 `--env <环境名>`**，且该环境的所有上游资源绑定必须已正确配置。

本机联调时，可以在对应 Wrangler 本地变量文件中配置：

```dotenv
IMAP_BRIDGE_URL=http://127.0.0.1:3033
IMAP_BRIDGE_SECRET=同一服务端Key
```

HTTP 只允许回环地址用于开发；生产必须 HTTPS。不要把 `.dev.vars*` 或带真实 Key 的 `.env` 提交到 Git。

接着按你已工作的 Zero 前端部署流程重新构建：

```bash
# 仓库根目录
pnpm --filter @zero/mail build
```

需要保留原有 `VITE_PUBLIC_BACKEND_URL`、应用域名、Cookie 域名、认证回调等配置，后端 CORS 必须允许该 Web 域名。前端 API Key 不能使用 `VITE_` 环境变量注入。

在已经登录 Zero 的浏览器访问：

```text
https://你的Zero域名/imap
```

首次点击“邮箱与 AI 设置”，选 QQ 或 163，填写邮箱地址和客户端授权码。服务端会依次验证 IMAP 和 SMTP。先使用一个专门测试邮箱，不要立即迁移唯一主力邮箱。

## 7. 配置自己的 AI API

先在桥接 `.env` 中允许服务 origin，再重启容器应用修改：

```bash
docker compose up -d
```

在 `/imap` → “邮箱与 AI 设置”里填：

```text
Base URL：服务商提供的兼容接口前缀，例如 https://llm.example.com/v1
模型名称：该服务商实际支持的精确模型 ID
API Key：你自己的 Key
```

客户端和服务端追加 `/chat/completions`。不要把完整 `/chat/completions` 地址填到 Base URL。原生 Anthropic/Gemini 接口不是该协议，需使用兼容网关；并非所有称为“兼容”的模型都支持相同参数，本版发送 `max_tokens` 和非流式文本请求，应先实际验证。

使用 Ollama 等本地兼容服务时，在 Docker 可达的网络中提供服务，并显式允许对应 origin，例如 `http://ollama:11434`，页面中填 `http://ollama:11434/v1`。容器内的 `localhost` 是容器自己；不要以为它指向宿主机。无鉴权服务初次配置时 Key 可以留空。已有 Key 需要清空时先点击“删除 Key 和配置”，再重新保存。

本版 AI 设置只作用于新工作区，**不会** 自动替换 Zero 旧的聊天 Agent、向量检索、自动标签等模型设置。

AI 输出需要人工审核，永远不会自动执行发信、删除、转发或日历操作。API 费用由你配置的服务商收取，不包含在任何邮箱客户端免费额度内。

## 8. iOS / Android 构建脚手架

**此部分只完成静态资源打包配置。原生 OAuth / 安全 Token 存储 / 深度链接 / CORS / 推送 / 附件分享需要继续实现和真机验收。不能把能打开 WebView 当成移动邮箱已经完成。**

Capacitor 8 的官方要求以文档为准：Node 22+；iOS 要在 macOS + Xcode 26+ 构建；Android 需要对应的 Android Studio 和 SDK。本环境没有运行这些工具，也没有生成 IPA/APK。

```bash
# 先在仓库根目录成功构建 Web。
pnpm --filter @zero/mail build

cd native/mobile
npm install
npm run prepare:web
npm run add:ios       # 仅 macOS；首次创建一次
npm run add:android   # 首次创建一次
npm run sync

npm run open:ios
# 或
npm run open:android
```

配置使用包内 `www` 资源，没有生产 `server.url`，不会把任意远程网页默认为拥有原生插件权限。资源脚本拒绝缺失构建产物，并在 React Router 生成 `__spa-fallback.html` 时选择正确的 SPA 入口。

应用 ID 默认为 `com.tippye.zeromail`。平台工程生成后，再在 Xcode / Android Studio 设置你的签名、应用 ID、图标和发行配置；不要提交证书、私钥或 keystore。

**发布前阻塞项：** 系统浏览器 OAuth + PKCE / 单次回传凭证、Universal Links / Android App Links、Keychain / Keystore、严格 CORS、通知授权与 APNs/FCM、附件与文件交互、退出后的缓存清理。没有为解决登录而放开 `*` CORS、跨站导航或在 WebView 中绕过认证限制。

目前跨 iOS / Android / macOS / Windows 的实际可用入口应先采用 HTTPS Web 页面；不宣称已有四端原生客户端。

## 9. 测试与真实验收

已在实现环境执行：

```bash
cd integrations/imap-bridge
npm test                     # 33 个依赖注入 / 本地 HTTP 测试
npm run check                # Node 语法检查

cd ../../native/mobile
npm test                     # 4 个静态资源准备测试
```

新增 TypeScript/TSX 做过语法转译检查，**不是依赖完整的 TypeScript 类型检查，也不是完整 Web 构建**。

依赖安装后额外执行：

```bash
cd integrations/imap-bridge
npm ci --ignore-scripts
npm run test:dependencies     # 真实 ImapFlow API、Nodemailer MIME、mailparser 和 HTML 清理测试
npm audit --audit-level=high  # 当前 lockfile：0 个已知漏洞
```

`.github/workflows/imap-bridge.yml` 包含依赖测试、Docker 构建与容器健康检查；是否运行成功必须查看实际 GitHub Actions 结果，不能把存在工作流当作测试通过。

本次提交已完成真实 npm 依赖安装和依赖 API 测试。Docker 构建已尝试，但拉取 `node:22-bookworm-slim` 时 Docker Hub 超时，尚未进入代码构建步骤。仍未完成：完整仓库类型检查、真实 QQ/163 收发、AI 实际请求、原生构建或商店审核。

新模块包含经安装验证的独立 npm lockfile，CI 和 Docker 均使用 `npm ci`；上游 pnpm-lock 未改动。生产发布前仍应固定基础镜像摘要。不要声称当前镜像是可完全复现的生产构建。

建议验收：两个测试账号隔离；中文主题 / 正文 / 附件；另一客户端已读和移动后刷新；断网重连；UIDVALIDITY 重建；发送过程中断网不重发；已发送副本行为；不同用户无法读取对方邮箱；API 错误响应不包含 Key；手机登录和返回流程。

## 10. 备份、恢复与限制

停止桥接容器后备份命名卷，并单独保管 `.env` 中的加密 Key。`docker compose down` 不会默认删除卷，但 **不要使用 `down -v`**，除非明确要删除凭据和发件记录。恢复旧备份可能丢失较新的发件记录，恢复后不得盲目重试旧发送操作。

“加密存储”不等于端到端加密：服务器运行时必须能解密授权码连接服务商；拥有服务器和 Key 的管理员可访问邮箱。当前架构适合自己管理的单实例服务器，不是已经审计的多租户商业产品。

桥接服务不记录请求正文或供应商原始异常，新 `imap.*` 路由不使用上游完整载荷日志中间件。**上游仍有独立的 PostHog/Sentry/其他遥测，不应据此宣称整个 Zero 零遥测或已经通过隐私审计。** 部署个人邮箱前禁用不需要的上游追踪配置，并检查自己的代理日志和前端录屏配置。

默认不加载远程邮件图片；单封原始邮件限制 10 MiB；发送附件合计限制 8 MiB；每用户最多 20 个邮箱、120 个桥接请求/分钟；同一邮箱串行操作。没有永久 EXPUNGE 或自动清空垃圾箱操作。

## 11. 后续工程应从哪里继续

先完成干净环境构建、真实服务商集成测试、移动端认证，再考虑合并进原上游收件箱。之后把按需读取演进为独立同步任务、持久化邮箱游标、UIDVALIDITY 全量重建和删除/标记增量对账，最后接 APNs/FCM、离线缓存和会话聚合。

相关官方文档：

- IMAPFlow：<https://imapflow.com/docs/api/imapflow-client/>
- Nodemailer：<https://nodemailer.com/>
- React Router SPA / 预渲染：<https://reactrouter.com/how-to/pre-rendering>
- Capacitor 环境：<https://capacitorjs.com/docs/getting-started/environment-setup>
- Capacitor 配置：<https://capacitorjs.com/docs/config>
