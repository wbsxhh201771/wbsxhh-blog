---
sidebar_position: 1
title: Datadog Bits AI 技术细节
---

# Datadog Bits AI 技术细节

> 调研时间：2026-03-26 来源：Datadog 官方博客、工程博客、产品文档、DASH 2025 发布内容

---

## 一、产品矩阵

Bits AI 是 Datadog 的 AI 能力套件，2023 年以 GenAI copilot 形态首发，2025 年底演进为 autonomous agent 架构。当前包含三个核心 Agent 和多个辅助能力。

### 1.1 核心 Agent

| Agent | 状态 | 定位 |
| --- | --- | --- |
| Bits AI SRE | GA | 自主调查告警、定位根因、协调 incident response |
| Bits AI Dev Agent | Preview | 监控遥测数据，发现高影响问题后自动生成带测试的 PR |
| Bits AI Security Analyst | Preview | 自动分类 Cloud SIEM 信号，执行威胁调查 |

### 1.2 辅助能力

*   **Conversational App Building** — 自然语言生成 Datadog App UI 组件和 action，支持迭代式对话调整
    
*   **Data Analyst（Notebooks）** — 在 Notebooks 中通过自然语言生成查询序列、数据变换、join 和可视化
    
*   **Action Interface** — 自然语言执行基础设施操作，带 RBAC 策略校验和 Audit Trail 日志
    

---

## 二、Agent 架构

### 2.1 Shared Tasks 架构

三个 Agent 构建在统一的 shared tasks 系统上。查询数据、分析异常、扩缩容等核心能力被抽象为可复用的 task，Agent 之间通过 shared memory 共享状态。这个设计让新 Agent 可以快速组装部署，保持一致的用户体验。

### 2.2 Agent Harness（编排层）

2025 年底更新引入了新的 agent harness，即管理长时间运行任务的编排层。职责包括：任务规划与调度、工具调用编排、实时调整调查方向、与 MCP 工具集成。更新后调查耗时从此前的水平缩短到约 3-4 分钟（视复杂度），官方说法是"速度翻倍"。

### 2.3 推理流程（Hypothesis-Driven Investigation）

核心推理模式模拟人类 SRE 的调查方式，分五个阶段：

**阶段一：上下文收集。** 读取 monitor 消息，拉取 Confluence runbook，检索同一 monitor 的历史调查记录，执行探索性查询建立初始环境认知。

**阶段二：假设生成。** 基于收集到的上下文，动态生成多个根因假设。

**阶段三：假设验证。** 通过 purpose-built tools 查询遥测数据，将每个假设标记为 validated / invalidated / inconclusive。关键点：查询是围绕特定假设定向执行的，而非一次性拉取所有数据。

**阶段四：递归分支。** 验证通过的假设触发更深层的子假设生成，递归展开直到穷尽搜索空间或找到根因。这使系统能够发现多层因果关系。

**阶段五：结论输出。** 生成带支撑证据的根因分析报告，推送到 Slack / Teams / Incident Response / Case Management / Jira。

**设计迭代的教训：** 早期版本试图一次性查看所有遥测数据，12+ tool calls 产生大量矛盾信号，效果很差。改为 hypothesis-driven 后，系统只关注 monitor alert 与特定假设之间的因果关系，显著提升了准确率。这个从"全量扫描"到"定向验证"的转变是核心设计决策。

### 2.4 Agent Trace（可观测性）

Agent Trace 视图完整暴露调查过程：每一步调用了什么工具、查询了什么数据、产生了什么中间分析。既是用户信任机制（可审计），也是 Datadog 内部调试和改进 Agent 的关键基础设施。

---

## 三、LLM 与模型策略

Datadog 对模型细节公开有限，已知信息：

*   使用 **OpenAI 的 LLM** 作为底层模型之一
    
*   同时使用多种 proprietary 和 open source LLM
    
*   自研了一个**时序数据优化模型**，专门处理 metrics 相关的分析
    
*   混合架构：统计分析和传统 ML 负责数据分析和行为预测，LLM 负责解释分析结果、生成自然语言响应、执行推理链
    
*   评估环节使用 **LLM judge** 对 Agent 结论打分
    
*   未来策略是根据不同用例 mix and match 不同 LLM
    

整体看，Datadog 走的是 ensemble 路线：不依赖单一 LLM 做所有事，而是让合适的模型做合适的事。这跟他们拥有大量结构化遥测数据的优势是匹配的。LLM 在这个架构里更多扮演推理编排和自然语言界面的角色，真正的数据分析靠专用模型和统计方法。

---

## 四、数据源

Bits AI SRE 可访问的数据源在持续扩展：

**基础遥测：** Metrics、Logs、Traces **平台数据：** Dashboards、Changes（变更事件）、Events **深度观测：** Real User Monitoring (RUM)、Database Monitoring、Network Path、Continuous Profiler **分析能力：** APM Latency Graphs、Watchdog Stories（ML 异常检测结果）、Synthetic Monitoring **代码与文档：** Source Code、Confluence Runbooks（外部集成）

数据源广度是 Bits AI 的核心壁垒。它能做到跨 metrics/logs/traces/code/infra 的联合推理，这对于没有全栈 observability 平台的竞争者来说很难复制。

---

## 五、MCP 工具设计

Datadog 构建 MCP Server 的工程经验是公开信息中技术含量最高的部分。核心发现：直接包装现有 API 给 Agent 用是不够的，observability 数据需要专门的工具设计。

### 5.1 Token 效率优化

*   **格式选择：** 表格数据用 CSV 而非 JSON，token 消耗减半；嵌套数据用 YAML，整体 token 开销降低约 20%
    
*   **字段裁剪：** 移除低频字段后，同等 token 量可容纳约 5x 的记录
    
*   **Token-based 分页：** 按 token budget 而非记录数分页。原因是单条日志从 100 字符到 1MB 不等，按条数分页无法有效控制 context 消耗。超出预算时中断结果并返回 continuation cursor
    

### 5.2 SQL 作为查询接口

让 Agent 写 SQL 查询日志数据，而非采样原始数据后在 context 里处理：

```sql
SELECT service, COUNT(*) as error_count
FROM logs WHERE status = 'error'
GROUP BY service
```

效果：准确率提升，成本降低约 40%（Agent 消耗更少 token）。Agent 可以在数据库端完成过滤、聚合、排序，而非把原始数据拉到 context window 里处理。

### 5.3 工具数量管理

三种策略控制工具膨胀：

*   **Flexible Tools：** 设计宽泛的工具（一个工具覆盖多个用例）而非一对一映射 API endpoint
    
*   **Toolsets：** 用户按需启用特定工具集，避免所有工具一起占用 context
    
*   **Layering：** 链式调用模式（先查能力再执行），减少前置 context 负载，代价是增加一轮 latency
    

### 5.4 Agent 引导机制

*   **错误消息要具体：** `invalid query` 导致 Agent 陷入重试循环；`unknown field stauts – did you mean status?` 给 Agent 明确的下一步
    
*   **按需查文档：** 内置 `search_datadog_docs` 工具（RAG 驱动），Agent 需要时查询语法文档，而非把文档塞进 tool description
    
*   **上下文提示：** 工具结果中嵌入引导信息，如搜索 `payment` 时建议 `payments` service
    

### 5.5 内部 Agent vs. 外部 MCP Server

Bits AI SRE 作为 hosted agent 可以做 alert-investigation 专用假设和 UI 优化。MCP Server 面向 Claude Code、Cursor、Codex 等第三方 agent，需要保持通用性，设计约束不同。

---

## 六、Bits AI Dev Agent 工作流

Dev Agent 的定位是从 observability 数据中发现问题并自动修复代码：

1.  从 Error Tracking / APM / Code Security / Continuous Profiler 检测高影响问题（crash、5xx、大面积用户影响）
    
2.  摄入 logs、traces、metrics、RUM events、security signals、runtime variables
    
3.  分析后生成 diff-ready patch + 测试代码，附带人类可读的上下文解释
    
4.  通过 GitHub App 自动创建 PR
    
5.  监控 CI 状态（Datadog CI Visibility 或 GitHub Actions），自动迭代直到测试通过
    
6.  低优先级问题给出解释说明为什么不需要修复，减少 alert fatigue
    

目前仅支持 GitHub，GitLab 和 Azure Repos 即将支持。未来计划提供安全沙箱用于 build-and-test 迭代，以及 Error Tracking 的 Autonomous Mode 设置。

---

## 七、评估方法

*   从 Datadog 客户真实 incident 中收集 benchmark 数据
    
*   由人类 responder 标注 incident 和 monitor alert
    
*   将归档遥测数据喂给 Agent 重放
    
*   LLM judge 对 Agent 结论打分，分数与人类判断对齐后生成 pass/fail
    
*   官方宣称根因定位速度提升 90%，单次调查耗时约 3-4 分钟
    

评估框架的设计思路是"用真实事件回放 + 人类标注 + LLM 评分"构成闭环。这个方法的优势是可规模化，劣势是 LLM judge 本身的准确性需要校准。

---

## 八、集成生态

**内部集成：** Slack、Microsoft Teams、Datadog Mobile App、Incident Response、Case Management **外部集成：** Jira（创建 ticket）、Confluence（读取 runbook）、ServiceNow、GitHub（PR 创建） **MCP Server：** 面向第三方 AI agent（Claude Code、Cursor、Codex、Goose）提供遥测数据访问，支持 Synthetics 和 Workflow Automation 等 toolset

---

## 九、关键判断

Bits AI 的技术路线比较务实。核心差异化在于 Datadog 本身拥有海量客户遥测数据和完整的 observability 工具链，Agent 的价值来自深度集成这些数据源，而非 LLM 本身的突破。几个值得关注的工程选择：

1.  **Hypothesis-driven 推理模式** — 从"全量扫描"到"定向验证"的转变是产品化的关键。这个教训对任何基于 LLM 做数据分析的系统都适用
    
2.  **MCP 工具的 token 效率设计** — CSV 替代 JSON、SQL 查询接口、token-based 分页，这些细节决定了 Agent 在实际场景中是否可用
    
3.  **Shared tasks 复用架构** — 让多个 Agent 共享核心能力，降低新 Agent 的开发成本
    
4.  **Ensemble 模型策略** — 不押注单一 LLM，而是让专用模型做专用事，LLM 负责推理和交互
    

---

## 参考来源

*   [How we built an AI SRE agent](https://www.datadoghq.com/blog/building-bits-ai-sre/)
    
*   [Meet the new Bits AI SRE: Deeper reasoning, twice as fast](https://www.datadoghq.com/blog/bits-ai-sre-deeper-reasoning/)
    
*   [Introducing Bits AI SRE](https://www.datadoghq.com/blog/bits-ai-sre/)
    
*   [Introducing Bits AI, your new DevOps copilot](https://www.datadoghq.com/blog/datadog-bits-generative-ai/)
    
*   [Bits AI Dev Agent](https://www.datadoghq.com/blog/bits-ai-dev-agent/)
    
*   [Designing MCP tools for agents](https://www.datadoghq.com/blog/engineering/mcp-server-agent-tools/)
    
*   [DASH 2025 feature roundup](https://www.datadoghq.com/blog/dash-2025-new-feature-roundup-keynote/)
    
*   [Bits AI 官方文档](https://docs.datadoghq.com/bits_ai/)
    
*   [Bits AI SRE 产品页](https://www.datadoghq.com/product/ai/bits-ai-sre/)
    
*   [Bits AI Agents 产品页](https://www.datadoghq.com/product/ai/bits-ai-agents/)