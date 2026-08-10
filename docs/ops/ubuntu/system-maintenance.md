---
sidebar_position: 6
title: 系统维护速查
---

# 系统维护速查

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

Ubuntu 服务器初始化与维护中的常用命令，按场景分节。

<h2 id="libreoffice">卸载 LibreOffice</h2>

服务器通常不需要桌面办公套件，可卸载以节省空间：

```bash
sudo apt remove --purge libreoffice*
sudo apt autoremove
sudo apt clean
```

<h2 id="nouveau">禁用 nouveau 驱动</h2>

安装 NVIDIA 专有驱动前，需禁用开源 nouveau 驱动以避免冲突。

```bash
sudo vim /etc/modprobe.d/blacklist-nouveau.conf
```

写入：

```
blacklist nouveau
options nouveau modeset=0
```

更新 initramfs 并检查：

```bash
sudo update-initramfs -u
lsmod | grep nouveau
```

若无输出，重启后 nouveau 应已禁用。

<h2 id="qemu-guest-agent">安装 QEMU Guest Agent</h2>

在 Proxmox / KVM 等虚拟化环境中，Guest Agent 用于向宿主机报告 IP、执行关机等操作。

**Debian / Ubuntu：**

```bash
sudo apt-get install qemu-guest-agent -y
sudo systemctl start qemu-guest-agent
sudo systemctl enable qemu-guest-agent
```

**RHEL / CentOS：**

```bash
sudo yum install qemu-guest-agent -y
sudo systemctl start qemu-guest-agent
sudo systemctl enable qemu-guest-agent
```

验证服务状态：

```bash
systemctl status qemu-guest-agent
```
