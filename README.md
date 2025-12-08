# camofy-mirror（Vercel 代理示例）

本目录提供一个在 Vercel 上部署的代理示例，用于将原本访问 GitHub 的路径切换为访问自定义域名（例如 `mirror.camofy.app`），从而绕过客户端环境对 GitHub 的访问限制。

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

