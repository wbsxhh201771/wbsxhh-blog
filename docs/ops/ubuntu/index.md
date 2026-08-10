---
sidebar_position: 0
slug: /ops/ubuntu
title: Ubuntu 运维手册
---

# Ubuntu 运维手册

本目录为博客文章 [新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist) 的**详细操作文档**，收录 Ubuntu 22.04 服务器初始化与日常维护的命令步骤。

## 文档列表

| 文档 | 场景 |
|------|------|
| [Ubuntu Server 安装指南](/docs/ops/ubuntu/server-install) | 启动盘制作、BIOS、安装向导、LVM 扩容等从零安装 |
| [Docker + Compose V2 安装](/docs/ops/ubuntu/docker-compose-v2) | 从官方源安装 Docker CE 及 Compose 插件 |
| [VSCode Docker 插件权限](/docs/ops/ubuntu/docker-vscode-permissions) | 解决 VSCode Remote / Docker 插件无权限访问 Docker |
| [SSH 仅允许密钥登录](/docs/ops/ubuntu/ssh-key-only) | 禁止密码登录，排查 cloud-init 配置覆盖问题 |
| [静态 IP 与 Netplan 配置](/docs/ops/ubuntu/static-ip-netplan) | 配置静态 IP，避免重启后被 cloud-init 还原为 DHCP |
| [系统维护速查](/docs/ops/ubuntu/system-maintenance) | 防火墙、卸载软件、显卡驱动、虚拟化 Agent |

## 阅读建议

1. 从零安装时，先读 [Ubuntu Server 安装指南](/docs/ops/ubuntu/server-install)
2. 再读[博客](/blog/ubuntu-server-setup-checklist)了解初始化流程与踩坑背景
3. 按需查阅其余文档，复制命令逐步执行

> 适用环境：Ubuntu 22.04 LTS。其他版本命令可能略有差异。
