---
sidebar_position: 1
title: Ubuntu Server 安装指南
---

# Ubuntu Server 安装指南

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

本文整理自 Ubuntu Server 20.04 安装实践。22.04 / 24.04 安装器界面与步骤大体相同，差异主要在默认 netplan 文件名（如 `00-installer-config.yaml` vs `50-cloud-init.yaml`）。

## 1. 制作启动盘

### 1.1 下载镜像

从 [Ubuntu 官网](https://ubuntu.com/download/server) 下载 Server 版 ISO，按需求选择 LTS 版本。

### 1.2 制作启动 U 盘

使用 [Rufus](https://rufus.ie/) 写入 ISO：

| 选项 | 建议值 |
|------|--------|
| 分区类型 | GPT |
| 目标系统 | UEFI（非 CSM） |

**GPT vs MBR 简要说明：**

- MBR：最多 4 个主分区，单盘最大约 2TB
- GPT：无上述限制，2012 年后主流 PC 多为 UEFI + GPT

**UEFI + GPT 安装 Ubuntu 时**：分区无需单独 `/boot`，需有 **EFI 系统分区**；Legacy + MBR 则需 `/boot` 分区。

### 1.3 BIOS 设置

U 盘插入后重启，按厂商热键进入 BIOS（常见 F2 / F2+Fn，因机型而异）：

1. **Secure Boot**：`Security → Secure Boot → Disabled`
2. **启动顺序**：`Boot → Boot Option #1 → UEFI USB Key` 置顶
3. **保存退出**：`Exit → Save Changes and Reset`

## 2. 系统安装

### 2.1 安装向导

按安装器步骤操作：

1. 选择 **Install Ubuntu**，回车
2. **语言 / 键盘**：默认回车即可
3. **网络配置**：见下节
4. **代理**：默认回车
5. **镜像源**：默认或填国内源，如 `http://mirrors.aliyun.com/ubuntu/`
6. **磁盘分区**：默认整盘自动分区；手动分区选 `[custom storage layout]`
7. **系统信息**：主机名、用户名、密码
8. **OpenSSH**：空格勾选 **Install OpenSSH server**，Tab 到 Done
9. **预置环境（Snaps）**：按需选择或跳过
10. 等待安装完成，**拔掉启动盘** 后回车重启

### 2.2 安装阶段网络配置

安装器里可选手动静态 IP：

1. 选中网卡 → **IPv4** → **Manual**
2. 填写：

| 字段 | 说明 | 示例 |
|------|------|------|
| Subnet | CIDR 格式 | `192.168.199.0/24`（/24 = 255.255.255.0） |
| Address | 本机 IP | `192.168.199.10` |
| Gateway | 网关 | `192.168.199.1` |
| Name servers | DNS | `114.114.114.114` |

:::info
安装完成后若需**再次修改**静态 IP，且系统由 cloud-init 管理网络，请参阅 [静态 IP 与 Netplan 配置](/docs/ops/ubuntu/static-ip-netplan)，避免重启后被还原为 DHCP。
:::

## 3. 安装后配置

### 3.1 设置 root 密码

```bash
sudo passwd root
```

### 3.2 SSH 服务

确认 OpenSSH 已安装并运行：

```bash
ps -ef | grep ssh
sudo systemctl status ssh
```

若未安装：

```bash
sudo apt-get update
sudo apt-get install openssh-server
sudo systemctl restart ssh
```

**安全建议**：生产环境请禁止 root 密码登录、禁止 SSH 密码登录，见 [SSH 仅允许密钥登录](/docs/ops/ubuntu/ssh-key-only)。不建议长期使用 `PermitRootLogin yes`。

### 3.3 系统与驱动更新

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install ubuntu-drivers-common
sudo ubuntu-drivers autoinstall
```

### 3.4 静态网络（Netplan）

编辑 netplan 配置（文件名因安装方式而异）：

```bash
ls /etc/netplan/
sudo vim /etc/netplan/00-installer-config.yaml   # 或 50-cloud-init.yaml
```

示例：

```yaml
network:
  ethernets:
    enp0s3:
      dhcp4: false
      addresses:
        - 192.168.1.10/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
  version: 2
```

将 `enp0s3` 替换为 `ip link` 看到的实际网卡名。

```bash
sudo netplan apply
```

云镜像 / 虚拟机务必先 [禁用 cloud-init 网络管理](/docs/ops/ubuntu/static-ip-netplan#1-禁用-cloud-init-网络管理必做)。

### 3.5 禁止自动休眠（物理机 / 笔记本）

查看休眠目标状态：

```bash
systemctl status sleep.target
```

若 `loaded` 表示自动休眠开启，可关闭：

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo systemctl set-default multi-user.target
```

编辑 `/etc/systemd/logind.conf`：

```bash
sudo vim /etc/systemd/logind.conf
```

设置：

```
IdleAction=ignore
IdleActionSec=0
```

笔记本还可将 `HandleLidSwitch`、`HandleLidSwitchExternalPower` 设为 `ignore`，避免合盖挂起。

恢复默认：

```bash
sudo systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target
sudo systemctl set-default graphical.target
sudo systemctl restart systemd-logind.service
```

### 3.6 定时关闭显示器（可选）

编辑 `/etc/default/grub`：

```bash
GRUB_CMDLINE_LINUX_DEFAULT="ipv6.disable=1 consoleblank=300"
```

`consoleblank=300` 表示控制台空闲 300 秒后关闭显示。然后：

```bash
sudo update-grub
sudo reboot
```

### 3.7 LVM 磁盘扩容

Ubuntu Server 默认 LVM 安装可能只使用约一半磁盘空间。

查看卷组：

```bash
sudo vgdisplay
df -h
```

将剩余空间全部扩给根分区（路径以 `lvdisplay` / `df` 为准，注意 mapper 名中的 `-` 与 `--`）：

```bash
sudo lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv
sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv
df -h
```

**新增硬盘扩入现有 VG：**

```bash
# 假设新盘为 /dev/sdb，已分区为 /dev/sdb1
sudo vgextend ubuntu-vg /dev/sdb1    # ubuntu-vg 以 vgdisplay 为准
sudo lvextend -l +100%FREE /dev/mapper/ubuntu--vg-ubuntu--lv
sudo resize2fs /dev/mapper/ubuntu--vg-ubuntu--lv
```

### 3.8 关闭自动更新（可选）

编辑 `/etc/apt/apt.conf.d/20auto-upgrades`：

```
APT::Periodic::Update-Package-Lists "0";
APT::Periodic::Unattended-Upgrade "0";
```

禁用服务：

```bash
sudo systemctl stop unattended-upgrades
sudo systemctl disable unattended-upgrades
sudo systemctl status unattended-upgrades
```

关闭后建议定期手动更新：

```bash
sudo apt update
sudo apt upgrade
```

## 4. 安装完成后

系统装好后，建议继续阅读 [Ubuntu 运维手册](/docs/ops/ubuntu) 完成 Docker、SSH 加固、Guest Agent 等初始化：

| 步骤 | 文档 |
|------|------|
| 静态 IP（cloud-init 环境） | [静态 IP 与 Netplan](/docs/ops/ubuntu/static-ip-netplan) |
| SSH 仅密钥登录 | [SSH 配置](/docs/ops/ubuntu/ssh-key-only) |
| Docker 环境 | [Docker 安装](/docs/ops/ubuntu/docker-compose-v2) |
| 其他维护 | [系统维护速查](/docs/ops/ubuntu/system-maintenance) |
