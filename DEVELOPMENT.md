# Lifolio 开发指南

实际应用位于 `apps/web`（Next.js）、`apps/mobile`（Expo）和 `apps/backend`（FastAPI）。根目录及 `web/` 下的 HTML 是设计原型。两端共享 `packages/shared-types`、`packages/api-client` 和 `packages/tokens`。

## 本地启动

使用 Node.js 20.19+、pnpm 11.25.0 和 Python 3.12+。

```sh
pnpm install
cp apps/web/.env.local.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

在两个客户端的环境文件中填写 Supabase URL、匿名公钥和后端 URL。服务端配置与数据库迁移参见 [后端指南](apps/backend/README.md)。服务端凭据和用户模型密钥不能放进 `NEXT_PUBLIC_*` 或 `EXPO_PUBLIC_*` 环境变量。

```sh
# 分别在两个终端运行；会先构建共享包
pnpm web
pnpm mobile
```

Web 默认使用 `http://localhost:3000`，后端使用 `http://localhost:8000`。手机真机的 `EXPO_PUBLIC_API_BASE_URL` 应填写电脑的局域网地址；后端需监听 `0.0.0.0`。手机上的 `localhost` 指向手机本身。

## 本次开发范围

- 双端 AI 对话支持新建、历史列表、继续对话、重命名、删除和停止生成。
- 双端设置支持模型服务商、兼容 API 地址、对话/视觉模型、温度、自有 API Key、测试连接及恢复默认。
- API Key 留空表示保留已保存密钥；切换服务商需重新填写。连接测试使用表单当前配置，不会自动保存。
- 网络、模型和保存失败会显示具体状态；未完整生成的回复不写入历史。重开会话会读取服务器保存的数据。
- 基本设置补齐加载、重试和保存失败状态；两端均可设置 AI 语气与推送频率。

部署新功能前，必须在目标数据库执行尚未应用的迁移，包含 `003` 和 `004`，并配置稳定的加密密钥。仓库代码不会自动修改线上数据库。服务商预填模型名可以编辑，实际可用模型取决于账户权限。

## 验证命令

```sh
pnpm typecheck
pnpm test:client
pnpm build
cd apps/backend
.venv/bin/python -m pytest -q
```

移动端 JavaScript 与资源打包检查（不生成安装包）：

```sh
pnpm --filter @lifolio/mobile exec expo export --platform ios --platform android
```

原生安装包、真机相机、真实账户跨设备同步和真实模型连接需要对应设备、数据库配置和服务商凭据。`expo export` 与使用模拟服务的浏览器验证不能替代这些检查。当前 EAS 项目仍需绑定自己的项目后再构建签名安装包。
