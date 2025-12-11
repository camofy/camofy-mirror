# camofy-mirror（Vercel / Cloudflare Workers 代理示例）

本目录提供一个在 Vercel 或 Cloudflare Workers 上部署的代理示例，用于将原本访问 GitHub 的路径切换为访问自定义域名（例如 `mirror.camofy.app`），从而绕过客户端环境对 GitHub 的访问限制。

## 设计目标

- 路径保持与 GitHub 一致，用户只需 **替换域名** 即可：
  - 原始下载地址：
    - `https://github.com/camofy/camofy/releases/latest/download/camofy-linux-amd64`
  - 通过代理下载：
    - `https://mirror.camofy.app/camofy/camofy/releases/latest/download/camofy-linux-amd64`
- 同样适用于 `raw` 路径，例如安装脚本：
  - 原始：
    - `https://github.com/camofy/camofy/raw/main/install.sh`
  - 代理：
    - `https://mirror.camofy.app/camofy/camofy/raw/main/install.sh`

这样，安装命令可以直接用替换域名的方式切换：

```sh
# 走 GitHub
curl -fsSL https://github.com/camofy/camofy/raw/main/install.sh | sh

# 走 mirror（Vercel）
curl -fsSL https://mirror.camofy.app/camofy/camofy/raw/main/install.sh | sh
```

脚本内部如果访问：

```text
https://github.com/camofy/camofy/releases/latest/download/camofy-linux-amd64
```

则可以通过替换为：

```text
https://mirror.camofy.app/camofy/camofy/releases/latest/download/camofy-linux-amd64
```

来统一走代理。

## 部署到 Vercel

1. 将 `camofy-mirror` 目录内容复制到一个单独的 Git 仓库（或在本仓库中选择 `camofy-mirror` 作为项目根目录）。  
2. 在 Vercel 创建新项目，选择该仓库并部署。  
3. 在 Vercel 项目设置中为该项目绑定自定义域名，例如：`mirror.camofy.app`。  
4. 在 DNS 服务商处将 `mirror.camofy.app` 的 CNAME 指向 Vercel 提供的域名。  
5. DNS 生效后，即可通过：

   ```sh
   curl -fsSL https://mirror.camofy.app/camofy/camofy/raw/main/install.sh | sh
   ```

   以及：

   ```text
   https://mirror.camofy.app/camofy/camofy/releases/latest/download/camofy-linux-amd64
   ```

   等路径完成安装和下载。

## 部署到 Cloudflare Workers

Cloudflare Workers 版本在 `worker.ts` 中，逻辑与 Vercel 版本保持一致：

- 保留原始路径结构，只是更换域名；
- 只允许代理 `camofy` 和 `MetaCubeX` 两个 GitHub 账号下的仓库；
- 同时兼容 `https://github.com/...` 和 `https://api.github.com/repos/...` 两种访问方式。

### 准备

1. 安装 Wrangler（本地未安装时）：

   ```sh
   npm install -g wrangler
   # 或者在项目中：
   npm install -D wrangler
   ```

2. 登录 Cloudflare：

   ```sh
   wrangler login
   ```

### 配置

仓库中已经提供了基础的 `wrangler.toml`：

```toml
name = "camofy-mirror"
main = "worker.ts"
compatibility_date = "2024-01-01"
```

根据自己的情况可以在 Cloudflare 控制台或 `wrangler.toml` 中配置路由，例如：

```toml
routes = ["https://mirror.camofy.app/*"]
```

> 注意：请将 `mirror.camofy.app` 替换为你自己的域名。

### 部署

在项目根目录执行：

```sh
wrangler deploy
```

部署完成后，即可通过：

```sh
curl -fsSL https://你的域名/camofy/camofy/raw/main/install.sh | sh
```

以及：

```text
https://你的域名/camofy/camofy/releases/latest/download/camofy-linux-amd64
```

等路径进行安装和下载，效果与 Vercel 部署基本一致。

