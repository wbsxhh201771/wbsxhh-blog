---
sidebar_position: 5
title: 静态 IP 与 Netplan 配置
---

# 静态 IP 与 Netplan 配置

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

Ubuntu 云镜像 / 虚拟机默认由 **cloud-init** 管理网络。仅编辑 `/etc/netplan/50-cloud-init.yaml` 并 `netplan apply`，重启后配置可能被 cloud-init **还原为 DHCP**。

文件头部注释已说明：

```
# This file is generated from information provided by the datasource.  Changes
# to it will not persist across an instance reboot.
```

## 1. 禁用 cloud-init 网络管理（必做）

创建配置文件，禁止 cloud-init 在重启时覆盖 netplan：

```bash
sudo vim /etc/cloud/cloud.cfg.d/99-disable-network-config.cfg
```

写入：

```yaml
network: {config: disabled}
```

## 2. 配置静态 IP

查看网卡名（常见为 `ens18`、`eth0` 等）：

```bash
ip link show
ls /etc/netplan/
```

编辑 netplan 配置（可直接改 `50-cloud-init.yaml`，或新建如 `01-static.yaml`）：

```bash
sudo vim /etc/netplan/50-cloud-init.yaml
```

示例（请按实际环境替换 IP、网关、DNS、网卡名）：

```yaml
network:
    ethernets:
        ens18:
            dhcp4: false
            addresses:
              - 192.168.1.183/24
            routes:
              - to: default
                via: 192.168.1.187
            nameservers:
              addresses: [192.168.1.187]
    version: 2
```

| 字段 | 说明 |
|------|------|
| `ens18` | 网卡接口名，以 `ip link` 为准 |
| `addresses` | 静态 IP 与掩码（CIDR） |
| `routes.via` | 默认网关 |
| `nameservers.addresses` | DNS 服务器 |

## 3. 应用并验证

```bash
sudo netplan apply
ip addr show ens18
ip route show default
```

确认 IP、网关正确后再重启验证：

```bash
sudo reboot
```

重启后再次检查 IP，应仍为静态地址而非 DHCP 分配。

:::warning
远程 SSH 改 IP 前，请确保新 IP 可达，或保留控制台（Proxmox / 云厂商 VNC）访问，避免改错网段后失联。
:::

## 与 SSH 踩坑的共性

cloud-init 在云镜像上会同时影响 **SSH** 和 **网络** 配置：

| 场景 | cloud-init 覆盖位置 | 解决方式 |
|------|---------------------|----------|
| SSH 密码仍可登录 | `/etc/ssh/sshd_config.d/50-cloud-init.conf` | 改该文件或禁用相关 cloud-init 模块 |
| 静态 IP 重启变 DHCP | `/etc/netplan/50-cloud-init.yaml` | 禁用 cloud-init 网络：`99-disable-network-config.cfg` |
