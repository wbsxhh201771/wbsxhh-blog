---
slug: ubuntu-server-setup-checklist
title: Ubuntu 服务器的踩坑清单：我踩过的坑
authors: [wbsxhh]
tags: [ubuntu, ops, linux]
date: 2026-08-10
---

> 整理自日常 Ubuntu 22.04 服务器初始化笔记。

自从我折腾了一台e5洋垃圾服务器，往里面装了pve虚拟机系统，当我每次新增ubuntu虚拟机时——我都会做几件事：配静态 IP、加固 SSH、装 Docker、按需做系统瘦身。这些步骤不复杂，但 cloud-init 会在两处让人踩坑：SSH「写了却不生效」、静态 IP「重启又变 DHCP」等问题就是我踩到的坑。

{/* truncate */}

## 典型场景

新机器装完 Ubuntu 22.04 后，通常需要：

1. **网络**：配置静态 IP（内网服务器常见需求）
2. **安全**：禁止密码登录，只允许密钥
3. **开发环境**：Docker + Compose V2，配合 VSCode Remote 使用
4. **系统维护**：卸无用软件、虚拟化环境下装 Guest Agent

下面按这几条主线说明「为什么做」和「踩坑点」。**从零安装系统**见 [Ubuntu Server 安装指南](/docs/ops/ubuntu/server-install)；PVE 导入镜像或装好后，继续看 [Ubuntu 运维手册](/docs/ops/ubuntu)。

## 网络：静态 IP 重启变 DHCP

内网虚拟机常要固定 IP。改 `/etc/netplan/50-cloud-init.yaml` 后 `netplan apply` 当时生效，**重启却又回到 DHCP**。

原因是 cloud-init 在每次启动时会根据 datasource 重写 netplan。文件头注释写得很清楚：*Changes to it will not persist across an instance reboot*。正确做法是先禁用 cloud-init 的网络管理：

```bash
sudo vim /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
```

写入 `network: {config: disabled}`，再编辑 netplan 配静态 IP。完整示例见 [静态 IP 与 Netplan 配置](/docs/ops/ubuntu/static-ip-netplan)。

:::warning
远程改 IP 前确保新地址可达，或保留 Proxmox / 云控制台，避免改错网段后失联。
:::

## 安全：SSH 只允许密钥

第一件事是改 `/etc/ssh/sshd_config`，设 `PasswordAuthentication no`、`PubkeyAuthentication yes`。改完重启 sshd，用密码试登录——**居然还能登**。

排查后发现 Ubuntu 云镜像会在 `/etc/ssh/sshd_config.d/50-cloud-init.conf` 里写 `PasswordAuthentication yes`，**覆盖主配置**。用下面命令搜一遍：

```bash
sudo grep -r PasswordAuthentication /etc/ssh/
```

把 `50-cloud-init.conf` 也改成 `no` 后，密码登录才真正被禁掉。完整步骤见 [SSH 仅允许密钥登录](/docs/ops/ubuntu/ssh-key-only)。

:::warning
改 SSH 前务必先配好公钥，并保留一个已登录会话，避免锁死。
:::

## 开发环境：Docker + VSCode

Docker 建议走[官方 APT 源](/docs/ops/ubuntu/docker-compose-v2)装 CE 和 Compose V2 插件（`docker compose`），不要再用旧版独立 `docker-compose`。

装完 Docker 后，VSCode Remote SSH 连上去常报 Docker 权限错误。正确做法是把用户加入 `docker` 组，而不是 `chmod 666 /var/run/docker.sock`——后者把 socket 暴露给所有用户，只适合临时调试。详见 [VSCode Docker 插件权限](/docs/ops/ubuntu/docker-vscode-permissions)。

## 系统维护：按需处理

桌面版镜像可[卸载 LibreOffice](/docs/ops/ubuntu/system-maintenance) 省空间；要装 NVIDIA 驱动则先[禁用 nouveau](/docs/ops/ubuntu/system-maintenance)；Proxmox / KVM 虚拟机建议[安装 qemu-guest-agent](/docs/ops/ubuntu/system-maintenance)，便于宿主机获取 IP 和优雅关机。

以上命令集中在 [系统维护速查](/docs/ops/ubuntu/system-maintenance) 一页，按需查阅即可。

## 小结

| 事项 | 文档 |
|------|------|
| 从零安装 Server | [安装指南](/docs/ops/ubuntu/server-install) |
| 静态 IP / Netplan | [含 cloud-init 禁用](/docs/ops/ubuntu/static-ip-netplan) |
| Docker + Compose V2 | [安装步骤](/docs/ops/ubuntu/docker-compose-v2) |
| VSCode Docker 权限 | [用户组方案](/docs/ops/ubuntu/docker-vscode-permissions) |
| SSH 密钥登录 | [含 cloud-init 排查](/docs/ops/ubuntu/ssh-key-only) |
| 软件 / 驱动 / 虚拟化 | [系统维护速查](/docs/ops/ubuntu/system-maintenance) |

博客记「为什么和踩坑」，文档放「可复制命令」——需要动手时直接打开 [Ubuntu 运维手册](/docs/ops/ubuntu) 即可。
