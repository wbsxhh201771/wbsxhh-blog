---
sidebar_position: 4
title: SSH 仅允许密钥登录
---

# SSH 仅允许密钥登录

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

在 Ubuntu 22.04 上配置 SSH 仅允许密钥登录、禁止密码登录。云主机常见坑：**cloud-init 生成的配置文件会覆盖主配置**。

## 1. 修改 sshd 主配置

编辑 `/etc/ssh/sshd_config`：

```bash
sudo vim /etc/ssh/sshd_config
```

确保以下两项：

```
PasswordAuthentication no
PubkeyAuthentication yes
```

## 2. 排查 cloud-init 覆盖（重要）

仅改 `sshd_config` 后，密码仍可能可以登录。原因是 Ubuntu 云镜像会在 `/etc/ssh/sshd_config.d/` 下生成额外配置，**优先级高于主文件**。

搜索所有相关配置：

```bash
sudo grep -r PasswordAuthentication /etc/ssh/
```

常见输出：

```
/etc/ssh/ssh_config:#   PasswordAuthentication yes
/etc/ssh/sshd_config:PasswordAuthentication no
/etc/ssh/sshd_config.d/50-cloud-init.conf:PasswordAuthentication yes
```

将 `sshd_config.d/50-cloud-init.conf` 中的 `PasswordAuthentication yes` 改为 `no`：

```bash
sudo vim /etc/ssh/sshd_config.d/50-cloud-init.conf
```

## 3. 重启 sshd

```bash
sudo service ssh restart
```

## 4. 验证

- 使用密钥登录：应成功
- 使用密码登录：应被拒绝

:::warning
修改前请确保已在目标账号下配置好公钥，并保留一个已登录的会话，避免把自己锁在门外。
:::
