---
sidebar_position: 2
title: Docker + Compose V2 安装
---

# Docker + Compose V2 安装

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

在 Ubuntu 上通过 Docker 官方 APT 源安装 Docker CE 及 Compose V2 插件（`docker compose`，非旧版 `docker-compose` 独立二进制）。

## 1. 卸载旧版本（可选）

若系统曾安装过旧版 Docker 或独立 `docker-compose`，先移除：

```bash
sudo apt remove docker docker.io docker-compose
```

## 2. 添加 Docker 官方 APT 源

```bash
sudo apt update
sudo apt install ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
```

## 3. 安装 Docker 及 Compose 插件

```bash
sudo apt install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

## 4. 验证安装

```bash
docker --version
docker compose version
```

**输出示例：**

```
Docker version 24.x.x, build abcdefg
Docker Compose version v2.x.x
```

## 5. 后续：VSCode 权限

若 VSCode Docker 插件报权限错误，请参阅 [VSCode Docker 插件权限](/docs/ops/ubuntu/docker-vscode-permissions)。
