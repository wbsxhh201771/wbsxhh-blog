---
sidebar_position: 3
title: VSCode Docker 插件权限
---

# VSCode Docker 插件权限

> 背景说明见博客：[新装 Ubuntu 服务器后的运维清单](/blog/ubuntu-server-setup-checklist)

安装 Docker 后，VSCode Remote SSH 或 Docker 插件可能因当前用户无权访问 Docker daemon 而报错。推荐通过用户组授权解决。

## 推荐方案：加入 docker 用户组

将当前用户（示例用户名为 `cy`，请替换为实际用户名）加入 `docker` 组：

```bash
sudo usermod -aG docker cy
newgrp docker
sudo systemctl restart docker
```

重新登录 SSH 会话后，无需 `sudo` 即可执行 `docker` 命令，VSCode 插件也能正常连接。

## 临时方案（不推荐）

```bash
sudo chmod 666 /var/run/docker.sock
```

此方式将 Docker socket 设为全局可读写，**存在安全风险**，仅适合本地临时调试。生产环境或长期开发请使用用户组方案。

## 验证

```bash
docker ps
```

无 `permission denied` 即表示配置成功。
