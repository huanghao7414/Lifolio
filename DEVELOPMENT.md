# Lifolio 开发指南

实际应用位于 `apps/web`（Next.js）、`apps/mobile`（Expo）和 `apps/backend`（FastAPI）。根目录及 `web/` 下的 HTML 是设计原型。两端共享 `packages/shared-types`、`packages/api-client` 和 `packages/tokens`。

## 本地启动

使用 Node.js 20.19+、pnpm 11.25.0、Python 3.12+ 和 `uv`。先在 Supabase 项目中按顺序执行尚未应用的 `apps/backend/supabase/migrations/001` 至 `005`，再配置三个应用的环境变量。

```sh
pnpm install
test -f apps/backend/.env || cp apps/backend/.env.example apps/backend/.env
test -f apps/web/.env.local || cp apps/web/.env.local.example apps/web/.env.local
test -f apps/mobile/.env || cp apps/mobile/.env.example apps/mobile/.env
```

在两个客户端的环境文件中填写 Supabase URL、匿名公钥和后端 URL。服务端配置与数据库迁移参见 [后端指南](apps/backend/README.md)。服务端凭据和用户模型密钥不能放进 `NEXT_PUBLIC_*` 或 `EXPO_PUBLIC_*` 环境变量。

```sh
# 终端 1：后端
cd apps/backend
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

```sh
# 终端 2：Web（在项目根目录）
pnpm web
```

```sh
# 终端 3：手机 App（在项目根目录）
pnpm mobile
```

Web 默认使用 `http://localhost:3000`，后端使用 `http://localhost:8000`。启动后先访问 `http://localhost:8000/health` 和 `/ready`；`/health` 仅说明进程在运行，`/ready` 会检查数据库。用 Expo Go 扫描终端二维码打开手机 App。手机真机的 `EXPO_PUBLIC_API_BASE_URL` 应填写电脑的局域网地址（例如 `http://192.168.1.23:8000`）；后端需监听 `0.0.0.0`，电脑和手机也要在同一网络。手机上的 `localhost` 指向手机本身。

## 注册或登录出现网络错误

Web 的邮箱注册、密码登录和短信验证直接访问 Supabase Auth；登录方式配置与业务数据访问 FastAPI。因此，后端 `/health` 正常不代表注册服务正常。

1. 检查 `http://localhost:8000/api/auth/config`：返回 JSON 说明登录方式配置接口可达；浏览器跨域访问还需确认后端允许当前 Web 地址。
2. 检查 `http://localhost:8000/ready`：返回 503 表示数据库检查未通过，结合后端日志检查 Supabase 连接与表结构。
3. 如果注册显示 `Failed to fetch` 或“无法连接账户验证服务”，在 Supabase 控制台确认项目正在运行，并核对 Project URL。若域名解析返回 `NXDOMAIN`，先检查项目状态与地址；这类错误不能通过修改 FastAPI 的 CORS 解决。不要关闭 TLS 校验。
4. 若更换项目，同步更新 Web、Mobile 和后端的 Supabase URL 与对应密钥，并在新项目应用数据库迁移；保留服务端密钥仅供后端使用。修改环境文件后重启相应开发服务，Mobile 需重新加载应用。

## 本次开发范围

- 双端 AI 对话支持新建、历史列表、继续对话、重命名、删除和停止生成。
- 双端设置支持模型服务商、兼容 API 地址、对话/视觉模型、温度、自有 API Key、测试连接及恢复默认。
- API Key 留空表示保留已保存密钥；切换服务商需重新填写。连接测试使用表单当前配置，不会自动保存。
- 网络、模型和保存失败会显示具体状态；未完整生成的回复不写入历史。重开会话会读取服务器保存的数据。
- 基本设置补齐加载、重试和保存失败状态；两端均可设置 AI 语气与推送频率。

部署新功能前，必须在目标数据库执行尚未应用的迁移，包含 `003`、`004` 和 `005`，并配置稳定的加密密钥。仓库代码不会自动修改线上数据库。服务商预填模型名可以编辑，实际可用模型取决于账户权限。

邮箱注册需要在 Supabase Auth 中启用 Email，并配置可用的邮件发送服务。短信注册需配置 Phone 与短信服务商，然后将后端的 `AUTH_PHONE_ENABLED` 设为 `true`。Google 登录需在 Supabase Auth 中配置对应 OAuth 凭据并将 `AUTH_GOOGLE_ENABLED` 设为 `true`。微信登录预留 `custom:<provider-id>` 配置，须先在 Supabase Auth 接入兼容的第三方 OAuth/OIDC 服务。管理员在后端 `ADMIN_USER_IDS` 填写逗号分隔的 Supabase 用户 UUID，然后用该账号登录 Web 的 `/admin`。这些开关本身不会开通外部服务或发送短信。

## 验证命令

```sh
pnpm typecheck
pnpm test:client
pnpm --filter @lifolio/web test:auth
pnpm build
cd apps/backend
.venv/bin/python -m pytest -q
```

移动端 JavaScript 与资源打包检查（不生成安装包）：

```sh
pnpm --filter @lifolio/mobile exec expo export --platform ios --platform android
```

原生安装包、真机相机、真实账户跨设备同步和真实模型连接需要对应设备、数据库配置和服务商凭据。`expo export` 与使用模拟服务的浏览器验证不能替代这些检查。当前 EAS 项目仍需绑定自己的项目后再构建签名安装包。
