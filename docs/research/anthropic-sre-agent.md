---
sidebar_position: 5
title: Anthropic SRE AI Agent 调研
---

# Anthropic SRE 方向 AI Agent 调研

> 调研时间：2026-03-31 调研范围：Anthropic AIRE 团队一手经验 + Claude Agent SDK SRE 实现 + 行业 SRE Agent 架构对比 目的：从 Anthropic 视角理解 SRE AI Agent 的能力边界、架构模式和落地路径

---

## 一、Anthropic AIRE 团队：组织与背景

Anthropic 组建了专门的 **AI Reliability Engineering (AIRE)** 团队，定位是"让 Claude 可靠运行"。团队横跨 Anthropic 最关键的 serving path，从 SDK 到网络、API 层、serving 基础设施、加速器，全链路提升韧性。

### 1.1 关键人物

**Todd Underwood（前负责人，已离职）** 在 Google 待了近 15 年，创建了 Google ML SRE 团队，曾任 Alphabet ML 容量工程高级总监。之后在 OpenAI 负责 Research Platform 的可靠性。合著 O'Reilly 的 _Reliable Machine Learning: Applying SRE Principles to ML in Production_（2022）。加入 Anthropic 后组建 AIRE 团队。2025 年底被 Rootly 评为"Reliability Top 50"。后已离开 Anthropic。

**Alex Palcuie（现任 AIRE MTS）** 在 Google Cloud Platform 做了 8 年 SRE，管理过大规模 GPU provisioning、可观测性和基础设施控制团队。参与过 Google 全公司级别的 Tech IRT（Google-wide 事故响应团队）和 GCP 的 Cloud IRT（GCP 事故响应创始工程师）。现在 AIRE 团队聚焦 Claude inference 层的可靠性。

### 1.2 AIRE 的定位

从招聘 JD 可以看出 AIRE 的工作范围：

*   领导关键 AI 服务的 incident response，确保快速恢复、深入复盘和系统性改进
    
*   支持 safeguard model serving 的可靠性
    
*   与 Anthropic 各团队合作，在最关键的 serving path 上提升鲁棒性
    

一个有趣的细节：AIRE 的名字本身就暗示了 AI 系统的可靠性工程和传统 SRE 存在本质差异。AI 基础设施（KV cache、GPU 集群、模型推理链路）有独特的故障模式，不能简单套用传统 SRE 方法论。

---

## 二、QCon London 2026 实战报告："Can Claude Fix Itself?"

2026 年 3 月，Palcuie 在 QCon London 做了一个非常坦诚的分享。这是目前公开信息中，Anthropic 内部用 AI 做 incident response 最详细的一手经验。

### 2.1 核心框架：OODA Loop 拆解 AI 能力边界

Palcuie 用军事决策理论的 OODA Loop（Observe → Orient → Decide → Act）来拆解 AI 在 incident response 各阶段的表现：

**Observe（观察）: 超人级** "它以 I/O 速度读日志，不会累。这种规模化能力人类无法匹配。" AI 在这个阶段的优势是压倒性的。日志分析、指标关联、异常检测，速度和耐心都远超人类。Palcuie 说他从 2026 年 1 月开始，incident 时第一个打开的工具是 Claude，而非传统监控工具。

**Orient（定向）: 混合，容易犯因果错误** AI 能快速关联信息，但系统性地把相关性当因果性。Palcuie 的原话："It's like a new joiner on the team who thinks 'oh, it's a capacity problem', when actually you lost your cache."

**Decide（决策）: 弱，缺乏组织上下文** AI 不知道你系统的十年历史，不知道那个 config 为什么长这样，不知道上次类似事故的政治背景。

**Act（执行）: 需要约束** 技术上可以执行，但需要 guardrails 和 approval workflow。

### 2.2 成功案例：新年夜 HTTP 500

2025-2026 跨年夜，Claude Opus 4.5 开始返回 HTTP 500。Palcuie 打开 Claude Code，让它查看情况。AI 写了一条 SQL 查询，几秒内定位到 image processing class 中的 unhandled exception。

这个案例体现了 AI 在 Observe 阶段的核心价值：快速缩小搜索空间。人在半夜被叫醒、脑子还没清醒的时候，AI 已经从海量日志中找到了关键线索。

### 2.3 失败案例：KV Cache 故障的误判

AI 推理依赖 KV cache，这个组件可以达到 GB 级大小且比较脆弱。当 KV cache 出问题时，会导致额外计算，监控上表现为请求量上升。Palcuie 每次问 Claude 发生了什么，Claude 都说"请求量增加，这是容量问题，需要加服务器"。

问题的本质是 Claude 看到了"请求量上升"和"性能下降"的相关性，就推断出"容量不足"的因果关系。但真实原因是 cache 失效导致的重复计算。这种 correlation vs causation 的错误在 AI 做 root cause analysis 时是系统性的。

### 2.4 Postmortem 的 80% 问题

Claude 生成的事后报告"80% 的故事很漂亮、可读、有说服力"，但 root cause 分析很差。Palcuie 指出，真正的根因从来不只是一个 rollout 或代码变更。"It was all the processes in the company that allowed the incident. And Claude doesn't know the history of your system, especially if your system has been there for ten years."

这一点对自建 SRE Agent 有直接启示：AI 生成的 postmortem 可以作为初稿加速流程，但组织层面的根因分析（为什么这个变更没有被 review 拦住？为什么 staging 没有覆盖这个场景？）仍然需要人来补充。

### 2.5 Jevons Paradox 与技能退化

Palcuie 引用了 Jevons Paradox：当技术提升效率时，更低的成本导致消耗上升。映射到 SRE 领域就是，AI 让写软件更容易，所以我们写更多软件，复杂度上升，系统以更难预测的方式崩溃。

他还提出了一个深层担忧：如果 Claude 自动修复了大量事故，人类怎么积累 incident response 的经验？SRE 需要"have been burnt before... they have the scar tissue"。如果新人从未经历过真实事故，他们在 AI 搞不定的极端场景下会无从下手。

### 2.6 Palcuie 的结论

"说 Claude 能解决一切是虚伪的。我的团队存在，我们在招很多人，这本身说明了问题。"

"模型今天是它们史上最差的时候。"

两句话的矛盾恰好描述了当前 SRE AI Agent 的现实：短期内无法替代人类 SRE，但能力增长趋势明确，现在的问题会逐步被解决。

---

## 三、Claude Agent SDK：SRE Incident Response Agent 架构详解

Anthropic 在官方 cookbook 中发布了完整的 SRE Agent 教程，这是目前最完整的端到端参考实现。

### 3.1 整体架构

```plaintext
Engineer (Slack) → Claude Agent SDK → MCP Tool Server → Infrastructure
                                          ↓
                                   PagerDuty / Confluence
```

**MCP（Model Context Protocol）模式：** Agent 通过 stdin/stdout 与 MCP tool server 通信，使用 JSON-RPC 协议。Tool server 作为独立子进程运行，实现工具与 Agent 的解耦。当 Agent SDK 需要调用工具时，它向 server 的 stdin 写入请求，server 分派到对应 handler 后将结果写回 stdout。

交互入口是 Slack：工程师在 channel 中 @agent，agent 在 thread 中流式输出工具调用和发现，保持调查过程完全可见。

### 3.2 工具设计：12 个工具，4 个类别

**调查类（Read-only，可随时安全调用）：**

*   `query_metrics` / `list_metrics`：查询和列举 Prometheus 指标
    
*   `get_service_health`：服务健康总览
    
*   `get_logs`：获取日志
    
*   `get_alerts`：获取告警
    
*   `get_recent_deployments`：获取最近部署
    
*   `execute_runbook`：执行运维手册
    

**修复类（Write，需要安全约束）：**

*   `read_config_file` / `edit_config_file`：读写配置文件
    
*   `run_shell_command`：执行 shell 命令
    
*   `get_container_logs`：获取容器日志
    

**文档类：**

*   `write_postmortem`：生成事后报告
    

**生产扩展：**

*   PagerDuty 工具：检查已有 incident（避免重复创建）、创建新 incident 并 page oncall、acknowledge、resolve
    
*   Confluence 工具：生成结构化 postmortem 页面
    

每个工具都有 JSON Schema 定义和详细描述。Agent 通过读取这些描述来判断何时、如何使用每个工具。

### 3.3 System Prompt 设计

cookbook 的一个关键设计洞察是 system prompt **刻意保持简单**。它给 Claude 一个通用的调查方法论框架，但不规定调用哪个工具、什么顺序、如何解读结果：

1.  先用 `get_service_health` 看总览
    
2.  深入 error rate 识别受影响服务
    
3.  检查 latency（高延迟通常先于错误出现）
    
4.  调查资源（DB 连接数、CPU、内存）
    
5.  读容器日志找具体错误信息
    
6.  检查配置文件找 misconfiguration
    
7.  关联所有症状，推导 root cause
    

这和 Palcuie 在 QCon 分享的实践一致：AI 在 Observe 阶段足够强，不需要手把手告诉它怎么读日志。把精力投在工具设计上，而非 prompt 工程上。

### 3.4 安全机制

**Hooks 机制：** 在 config edit 和 shell command 上挂 validation hooks。例如 `validate_pool_size.sh` 在修改数据库连接池配置前验证参数合理性，`validate_config_before_deploy.sh` 在部署前做配置校验。

**Permission Mode：** 使用 `acceptEdits` 模式，read 操作自动放行，write 操作需要通过 hooks 验证。

**Restricted Scope：** MCP 工具通过限定目录、命令白名单和验证逻辑来约束 agent 的操作范围。

### 3.5 Institutional Knowledge as Skills

cookbook 提到一个值得注意的设计：用 markdown 文件编码领域知识为 "skills"，告诉 agent 什么时候、如何应用特定领域的操作程序。这相当于把团队的 runbook 和经验知识结构化后注入 agent 的上下文。

这个思路对我们团队有直接参考价值：把现有的散乱 runbook 整理成 skill 格式，既改善了知识管理，又为 agent 提供了领域上下文。

### 3.6 生产架构扩展

cookbook 中的 demo 基础设施（PostgreSQL、Prometheus、API server）跑在本地 Docker 容器中。扩展到生产环境时，MCP server pattern 使得接入外部 API 非常直接：wrap 一个外部 API 为 MCP 工具，写好描述，加入 `allowed_tools`，agent 自动发现并使用。

---

## 四、行业 SRE Agent 架构对比

### 4.1 Datadog Bits AI SRE：Hypothesis-Driven Investigation

Datadog 的 Bits AI SRE 是目前商业产品中架构最值得参考的。

核心模式是 **hypothesis-driven investigation loop**：告警触发后，agent 先生成多个 root cause 假设，再针对性查询验证每个假设，标记为 validated / invalidated / inconclusive。这解决了两个工程问题：避免遍历所有遥测数据导致 context window 膨胀，以及让调查过程有可解释的推理链。

多层递归调查：验证某个假设后可以继续深挖子假设，形成分支调查路径，根据证据剪枝或扩展。

数据基础是其核心壁垒：处理数万家组织的 telemetry 数据，用数百个真实 incident 做 benchmark dataset，内部团队标注 ground truth，LLM judge 打分。声称 MTTR 减少 95%。

### 4.2 New Relic SRE Agent：Assistive AI

设计哲学明确："加速理解，而非自主行动"。刻意约束 agent 的自主权。

技术亮点是 **iRCA（Intelligent Root Cause Analysis）**：自动搜索实体的拓扑图，用概率因果模型打分，基于路径的排名算法在秒级缩小问题空间。这试图从架构层面解决 Palcuie 提到的 correlation vs causation 问题。

提供 no-code builder，让 SRE/DevOps 不写代码就能构建自定义 AI agent。2026 年被 IDC MarketScape 评为 AIOps Leader。

### 4.3 Komodor Klaudia：K8s 专项多 Agent

核心经验总结：**20% prompt engineering + 80% 自定义工具、评测和监控。**

**多 Agent 架构：**

*   Orchestrator agent：理解上下文，分派任务
    
*   SME（Subject Matter Expert）agents：领域专家，每个 agent 作用域窄，降低幻觉率
    

**"Swiss Cheese" 验证模型：** 多层防护，每层有不同的检查逻辑。单层可能有漏洞，但多层叠加后整体可靠性显著提升。

信任构建的关键设计：agent 解释它考虑过并拒绝了哪些方案，而非只给一个结论。在真实 K8s 环境上达到 95% 准确率。

### 4.4 incident.io AI SRE：自动分级

定位清晰：处理你不应该被叫醒的 incident。分类每个 alert，能自主解决的自主解决，需要人类判断的才升级。这个"auto-triage + selective escalation"模式对 oncall 体验的改善最直接。

---

## 五、架构模式提炼

从 Anthropic 和行业实践中，可以提炼出几个核心架构模式。

### 5.1 能力分层：AI 做 Observe，人做 Decide

这是目前最成熟也最安全的分工边界。所有成功案例都遵循这个模式，没有例外。

AI 的压倒性优势在 Observe 阶段：日志分析、指标关联、异常检测、搜索空间压缩。AI 的系统性弱点在 Decide 阶段：因果推断、组织上下文、历史知识、风险判断。

Orient 和 Act 阶段则根据场景和信任度逐步放权。

### 5.2 Tool Description > System Prompt

Anthropic cookbook 验证了一个反直觉的发现：与其写复杂的 system prompt 详细规定 agent 的行为，不如把精力投在 tool description 的质量上。Claude 足够聪明，能从工具描述中自行判断调用时机和方式。

这意味着 SRE Agent 的核心工程量在 MCP tool server 的设计上，而非 prompt 调优上。

### 5.3 Hypothesis-Driven vs Exhaustive

Datadog 的 hypothesis-driven 模式和"遍历所有数据再总结"的 naive 模式有本质区别。前者先建立假设再针对性验证，在 context window 和推理效率上都有优势。这也更接近资深 SRE 的实际工作方式。

### 5.4 多 Agent 分层

Komodor 和 Datadog 都走向了 orchestrator + specialist 模式。缩小每个 agent 的作用域能显著降低幻觉率。这和 Azure 的六大运维 Agent 思路一致。

### 5.5 真实 Incident 做 Eval

Datadog 用真实 incident 做 benchmark，Komodor 在真实 K8s 环境测准确率。合成数据不够用。这和 LLM 评测的经验一致：eval 的质量决定了迭代方向的正确性。

### 5.6 信任通过透明度建立

Komodor 要求 agent 解释被拒绝的方案，New Relic 刻意约束 agent 自主权。信任不来自自治能力，来自可预测性和可审计性。

---

## 六、对我们团队的启示

### 6.1 最直接的参考路径

Anthropic 的 SRE cookbook 是最完整的端到端参考实现。技术栈完全匹配（Claude Agent SDK + MCP），从本地 demo 到生产扩展有完整路径。建议作为 PoC 的起点。

### 6.2 从 Read-Only Investigation Agent 开始

Palcuie 的经验清楚表明：AI 在 Observe 阶段超人级，在 Decide 阶段系统性不足。所以第一步应该是 read-only 的 investigation agent，聚焦以下能力：

*   告警触发后自动拉取相关日志、指标、最近部署
    
*   生成调查摘要和初步假设
    
*   在 Slack thread 中输出，供 oncall 参考
    

不急于做 auto-remediation。

### 6.3 Institutional Knowledge 是差异化壁垒

所有商业产品的通用能力（日志分析、指标查询）趋同。差异化来自领域知识的注入。cookbook 中的 skill 机制（markdown 文件编码领域知识）提供了一个轻量的方式，把团队的 runbook 和经验转化为 agent 的上下文。

这也回应了 Palcuie 的观察："Claude 不知道你系统的十年历史。" 解法就是通过 skill 把这些历史知识结构化后喂给 agent。

### 6.4 评测体系要和 Agent 同步建设

参考 Datadog 的做法：收集真实 incident 数据，标注 ground truth，构建 benchmark dataset。没有评测就没有迭代方向。

### 6.5 Palcuie 的 Correlation vs Causation 问题需要架构级解法

单纯依赖 LLM 的推理能力无法解决因果推断问题。New Relic 的 iRCA（概率因果模型 + 拓扑图）和 Datadog 的 hypothesis-driven loop 是两种架构级解法。在设计 agent 时需要在 tool 层面引入因果推理逻辑，而非全部交给 LLM。

### 6.6 关于基础设施碎片化

已有调研文档（sre_ai_agent\_research.md 第八节）指出了我们可观测性基础设施碎片化的约束。Anthropic cookbook 的 MCP 模式恰好提供了一个解耦方案：每个数据源（hubble、ES、ClickHouse）各自实现一个 MCP tool server，agent 层面统一调用。碎片化在 tool server 层消化，不需要先统一底层数据源。

---

## 七、关键资源索引

| 资源 | 说明 | 链接 |
| --- | --- | --- |
| SRE Incident Response Agent Cookbook | Anthropic 官方 SRE Agent 端到端教程 | [platform.claude.com](https://platform.claude.com/cookbook/claude-agent-sdk-03-the-site-reliability-agent) |
| Claude Agent SDK Python | Agent SDK 源码 | [github.com/anthropics](https://github.com/anthropics/claude-agent-sdk-python) |
| QCon London Talk 报道 (The Register) | Palcuie 演讲的详细报道 | [theregister.com](https://www.theregister.com/2026/03/19/anthropic_claude_sre/) |
| QCon London Talk 报道 (DevClass) | 另一篇报道，补充细节 | [devclass.com](https://www.devclass.com/ai-ml/2026/03/23/fixing-claude-with-claude-anthropic-reports-on-ai-site-reliability-engineering/5209470) |
| Palcuie 个人博客 | 对 The Register 报道的回应 | [blog.palcu.net](https://blog.palcu.net/2026/03/the-register-qcon.html) |
| Todd Underwood 加入 Anthropic | AIRE 团队组建背景 | [datacenterdynamics.com](https://www.datacenterdynamics.com/en/news/former-google-and-openai-sre-todd-underwood-joins-anthropic-to-build-ai-reliability-engineering-team/) |
| Datadog Bits AI SRE 架构 | 最详细的商业 SRE Agent 架构描述 | [datadoghq.com](https://www.datadoghq.com/blog/building-bits-ai-sre/) |
| New Relic SRE Agent | Assistive AI 设计哲学 | [newrelic.com](https://newrelic.com/blog/observability/sre-agent-agentic-ai-built-for-operational-reality) |
| Komodor Agentic AI for SRE | 多 Agent 架构和信任模型 | [komodor.com](https://komodor.com/blog/building-trust-in-the-machine-a-guide-to-architecting-agentic-ai-for-sre/) |
| incident.io AI SRE | Auto-triage 模式 | [incident.io](https://incident.io/blog/introducing-ai-sre) |
| AIRE 招聘 JD | 团队职责和技术方向参考 | [greenhouse.io](https://job-boards.greenhouse.io/anthropic/jobs/5101169008) |
| SRE Agent System Prompts 分析 | 第三方对 cookbook system prompt 的拆解 | [wiki.strrl.dev](https://wiki.strrl.dev/GTD/references/2026-W10/claude-agent-sdk-sre-agent-system-prompts) |

---

_本文档基于 2026-03-31 的公开信息整理。Anthropic AIRE 团队仍在快速发展中，后续建议持续跟踪 Palcuie 的博客和 Anthropic engineering blog 的更新。_