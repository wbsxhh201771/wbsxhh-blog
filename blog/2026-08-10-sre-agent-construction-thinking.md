---
slug: sre-agent-construction-thinking
title: SRE Agent 构建思考：从行业调研到编排落地
authors: [wbsxhh]
tags: [sre, agent]
date: 2026-08-10
---

> 基于排障 Agent 建设方案讨论、L1 演进问题与编排流程分析整理。
## 要解决什么问题

告警响应的现状：oncall 收到告警后，需要登录多个系统拉取上下文（监控指标、日志、最近发布、配置变更、服务依赖），判断影响范围，定位根因，执行修复。这个过程依赖工程师的经验和对系统的熟悉程度，新人和老手之间的效率差距可以是数倍。

排障 Agent 的目标是把 **Observe 阶段**——收集上下文、关联信号、生成初步假设——自动化，让每个 oncall 工程师都能快速获得资深工程师级别的初步分析。

行业成功落地的案例都遵循「AI 调查 + 建议，人审批执行」的模式。

{/* truncate */}

## 行业三种架构路线

调研覆盖了 Datadog、Grafana、Komodor、Dash0、字节跳动、Azure 等 20+ 家公司的 SRE AI Agent 实践，按架构可归为三种模式。

### 模式 A：单 Agent + 假设驱动

代表：[Datadog Bits AI](/docs/research/datadog-bits-ai)。

告警触发后，单个 Agent 生成多个根因假设，逐个定向验证，验证通过的假设继续深挖子假设，形成递归调查链。早期版本一次性查看所有遥测数据，12+ tool calls 产生矛盾信号，效果很差；改为假设驱动后准确率显著提升。

### 模式 B：多 Agent 并行调查

代表：Grafana Assistant、Resolve.ai。

多个专业 Agent 同时展开调查（一个查 metrics、一个查 logs、一个查 traces），各自产出带置信度的发现，最后交叉验证合并结论。Grafana 内部实测中，AI 8 分钟定位根因（人工 28 分钟），核心加速来自并行分析多条调查线。

### 模式 C：Orchestrator + 领域专家 Agent（推荐）

代表：[Komodor](/docs/research/komodor)、[Dash0](/docs/research/dash0)、[字节跳动 SRE-Copilot](/docs/research/bytedance-sre-agent)、Azure Copilot。

一个编排器做意图理解和任务分派，按需调度领域专家 Agent。与模式 B 的区别：B 是同时并行调查，C 是按需调度。

**行业共识**：缩小每个 Agent 的作用域能显著降低幻觉率。K8s 问题和数据库问题的排查逻辑完全不同，与其让一个大 LLM 覆盖所有领域，不如把每个 agent 的 scope 缩到足够小。

## 分建还是统建？

SA、SRE、DBA、Network 各团队在排障中关注的数据源、排查逻辑、修复手段完全不同。三种方案对比如下：

| 方案 | 优势 | 问题 |
|------|------|------|
| **各自建各自的** | 领域深、迭代快、scope 窄准确率高 | 跨领域告警无人兜底，技术栈分裂 |
| **统一建一个大 Agent** | 天然支持跨领域、体验统一 | context 塞满后幻觉率急剧上升，跨团队协调慢 |
| **统一编排 + 领域专家** | 兼顾跨领域与专业化，各团队独立迭代 | 需要共建 Orchestrator 和基础框架 |

推荐 **方案三：统一编排 + 领域专家 Agent**：

```
                    ┌─────────────┐
                    │ Orchestrator │
                    │  (意图理解    │
                    │   路由分派)   │
                    └──────┬──────┘
              ┌────────┬───┴───┬────────┐
              ▼        ▼       ▼        ▼
         ┌────────┐┌───────┐┌──────┐┌─────────┐
         │DBA     ││Network││SA    ││SRE      │
         │Agent   ││Agent  ││Agent ││Agent    │
         └────────┘└───────┘└──────┘└─────────┘
              │        │       │        │
              ▼        ▼       ▼        ▼
         各团队的 MCP Tool Server（封装各自数据源）
```

**共建层**：Orchestrator、LLM 调用、MCP 协议、上下文管理、安全机制、通用工具（告警历史、发布变更、服务依赖、CMDB）。

**各建层**：各领域的 Specialist Agent，包含独立的 tool set 和领域知识。

## 关键工程决策

### 1. 工具设计比 Prompt 工程重要

Komodor 的经验数据：**20% prompt engineering + 80% custom tools, evals, monitoring**（详见 [Komodor 调研](/docs/research/komodor)）。每个团队的核心工作量在 MCP tool server 的设计上——工具描述的准确性、输出格式的 LLM 友好性、错误消息的引导性。

### 2. 查询接口优于原始数据拉取

让 Agent 写 SQL / PromQL 在数据源侧完成过滤和聚合，而非把原始数据拉到 context window 里处理。Datadog 实测准确率提升，成本降低约 40%（详见 [Datadog Bits AI 调研](/docs/research/datadog-bits-ai)）。

### 3. Token 效率是硬约束

- 表格数据用 CSV 而非 JSON，token 消耗减半
- 嵌套数据用 YAML，token 开销降低约 20%
- Token-based 分页替代记录数分页

### 4. 假设驱动而非全量扫描

Agent 收到告警后，应该先生成假设（「可能是最近发布导致」、「可能是数据库连接池耗尽」），再针对性查询验证。全量扫描是行业级教训。

### 5. 领域知识的结构化注入

每个团队现有的 runbook 和排障经验是最大的差异化资产。可参考 [Cleric AI 三层记忆系统](/docs/research/cleric-ai) 的设计思路。

### 6. 评测体系必须同步建设

每个团队收集 10-20 个历史典型告警案例，标注根因和排查过程，作为 benchmark dataset。合成数据不够用，必须用真实 incident。

### 7. 信任通过透明度建立

输出结构建议：What Happened（摘要）+ Related Evidence（证据）+ Suggested Remediation（修复步骤）+ Rejected Alternatives（被排除的方案及原因）。

## 实际编排：人工动作 ↔ Agent 链路

落地一个 SRE Agent 后，核心问题是：**人工怎么查 ↔ Agent 哪一轮、哪个 sub-agent、哪类工具在做等价动作**。

### 自动编排总览

```
告警 / CLI / webhook
        │
        ▼
resolve_initial_agent_type  ← classify_alert（metric / 关键词）
        │
        ▼
Orchestrator.investigate
  ├─ Round 1: 代码构造 seed dispatch（不跑 planner）
  ├─ Round 2..N: planner 读历史 verdict → dispatch 或 finalize
  └─ 预算耗尽 / 中断 → synthesis 出 partial 结论
        │
        ▼
InvestigationOutcome（summary + planner_verdict + dispatch_results）
```

### 入口分类：选谁做 seed

| 条件 | 首轮 agent | target_kind |
|------|-----------|-------------|
| 接入层 metric / 关键词 + domain | access | domain |
| 日志类 metric / error·panic 关键词 | log | service |
| 其余监控指标（默认兜底） | monitor | service |

### 三 Agent 职责

| Agent | target_kind | 数据源 | 人工对应动作 |
|-------|-------------|--------|-------------|
| access | domain | 接入层日志（nginx / gateway） | 看接入大盘、域名 5xx、upstream |
| log | service | 错误日志仓库 | 查 error/panic、堆栈、trace 下游 |
| monitor | service \| component | PromQL / 监控平台 | 查 RED、依赖、PG/Redis/Kafka、节点资源 |

### 通用步骤映射

| # | 人工步骤 | Agent 编排对应 |
|---|---------|---------------|
| 1 | 收报警，看规则、标签、等级 | InvestigationInput + AlertContext |
| 2 | 判断接入层 / 日志 / 指标类 | classify_alert → Round1 seed |
| 3 | 打开大盘：域名/接入 5xx | access seed / dispatch |
| 4 | 查 error / panic / 超时日志 | log agent |
| 5 | 查服务 RED、依赖、中间件 | monitor + playbook 裁剪 |
| 6 | 对照是否在滚动发布 | deploy prefetch + 交叉验证 |
| 7 | 锁定下游后继续追 | planner 消费 handoffs + dispatch |
| 8 | 写因果链 / 根因结论 | planner finalize → Outcome |
| 9 | 同步研发、止损、静默、工单 | **编排外（人工）** |

### 现象 → 优先路径速查

| 报警表征 | 优先 seed | 常见下一跳 | 人工兜底 |
|---------|----------|-----------|---------|
| 域名 / nginx 5xx | access | monitor（上游）或说明三方 | DNS 切换、换 IP |
| 服务 HTTP 5xx | monitor | log → PG/Redis handoff；对照 deploy | 研发确认、工单 |
| panic / error 日志计数 | log | monitor 排除资源 | 策略静默、排期修 |
| 业务/中间件 QPS 跌零 | monitor | 对照入口流量是否随动 | 策略例外 |
| 疑似发布抖动 | monitor + deploy | log 伴生错误 | 研发确认 |

## L1 演进：三个待解决问题

实际落地后，L1 阶段暴露出三个关键问题：

### 1. 缺少真实反馈闭环

未接入真实报警处理平台的评分/纠错，只能事后手工造评测集。Agent 无法从工程师的实际处置中学习。

### 2. 双报告机制缺失

缺「时限内短报告」（可点证据链、值班第一眼）与「深度事后长报告」的拆分。现在默认数分钟的完整调查，偏事后分析。

**短报告设计**（基于历史优先）：

- **拉历史**：同服务、同策略的近期告警；若有历次调查结论一并挂上
- **快推理**：是否像已知模式、上次根因与建议是什么
- **快调查**：只做轻量校验（近发布、关键指标是否仍红）
- **短报告输出**：结论草案 + 可点证据链 + 标注「沿用历史 / 建议深挖」
- **升级条件**：无历史、校验失败、低置信或有新变更时，再跑深度长报告

### 3. 同类告警结论未复用

相同服务、相同策略触发的告警，根因往往相同，但 agent 仍全量 LLM 推理（约 200s）。应增加「(服务名) + 报警策略组合 key 命中 → 短报告引用历史 + 轻量校验」的快路径。

## Agent 已覆盖 vs 编排外

### Agent 已覆盖

- 告警分类与首轮 agent 选择
- 接入 / 日志 / 指标多源取证与结构化 verdict（findings + handoffs）
- 多轮 planner 派发与去重门禁
- Monitor 按 playbook / seed.intent 裁剪排查路径
- Deploy 上下文预取，辅助「变更窗口」判断
- Finalize / synthesis 产出排查摘要与根因候选

### 编排外（人工闭环）

| 动作 | 说明 |
|------|------|
| 拉群、同步研发、口头确认 | 滚动发布、第三方、慢 SQL、panic |
| 策略静默 / 策略例外 | panic、QPS 跌零误报 |
| DNS 切换、换 IP、LB 摘除 | 第三方 504 |
| SQL 工单、代码排期上线 | 慢 SQL、panic |
| 三方客服 / 白名单 | 第三方故障 |

通知出口可以把结论推给人，但**不替代**上述操作。

## LLM 排障的已知局限

团队需要了解 LLM 在排障场景下的系统性弱点：

1. **因果推断不可靠**：LLM 擅长发现相关性，但在因果方向判断上系统性不可靠（[Anthropic AIRE 一手经验](/docs/research/anthropic-sre-agent)）。假设驱动 + 工具定向验证是最务实的起步方案。
2. **Postmortem 的 80% 问题**：生成的事后报告 80% 可读、有说服力，但根因分析很差。组织层面的根因分析仍然需要人来补充。
3. **Agent 不理解组织上下文**：不知道系统历史演进、配置为什么长这样、上次类似事故的处理策略。需要通过 runbook、skill、记忆系统结构化注入。

## 演进路径

```
Phase 1：单领域 PoC
  选一个数据源集中、告警场景标准化的领域试点
  输出：告警触发后的结构化上下文摘要（手动触发）

Phase 2：加入推理能力
  Agent 基于上下文生成假设并定向验证
  输出：根因假设 + 证据链 + 置信度 + 建议处置

Phase 3：多领域 + Orchestrator
  建设统一编排层，接入多个 Specialist Agent
  支持跨领域排查

Phase 4：知识积累 + 自动触发 + 短报告快路径
  累积结构化处置记录，同类告警结论复用
  告警触发后自动产出分析报告推送到 oncall
```

## 最后

SRE Agent 的构建不是「一个大 LLM + 全量数据」，而是：

1. **Orchestrator + 领域专家** 的分层架构，缩小每个 Agent 的 scope
2. **假设驱动** 而非全量扫描，**工具设计** 比 prompt 工程更重要
3. **人工动作 ↔ Agent 编排** 的清晰映射，明确 Agent 已覆盖与编排外的边界
4. **短报告 + 历史复用** 解决 L1 阶段的效率和时效问题
5. **评测体系同步建设**，用真实 incident 驱动迭代

核心原则：**AI 调查 + 建议，人审批执行**。Agent 的价值在于让每个 oncall 都能快速获得资深工程师级别的初步分析，而不是替代人做最终决策。

---

## 引用文档

详细行业调研材料见 [调研材料索引](/docs/research)：

| 文档 | 主题 |
|------|------|
| [Datadog Bits AI](/docs/research/datadog-bits-ai) | 假设驱动调查、MCP 工具设计 |
| [Komodor](/docs/research/komodor) | Multi-Agent 平台、SME Agent |
| [Dash0](/docs/research/dash0) | Agent0 编排、可观测性 Agent |
| [Cleric AI](/docs/research/cleric-ai) | 三层记忆、Knowledge Graph |
| [Anthropic SRE Agent](/docs/research/anthropic-sre-agent) | OODA 能力边界、AIRE 实践 |
| [字节跳动 SRE Agent](/docs/research/bytedance-sre-agent) | SRE-Copilot、按模态拆分 Agent |
