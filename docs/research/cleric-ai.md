---
sidebar_position: 4
title: Cleric AI 深度调研
---

# Cleric AI 深度调研

## 一句话定位

Cleric 是一个自学习的 AI SRE Agent，接入生产环境后自主调查 incident、做根因分析，核心卖点是"operational memory"，即每次调查都让系统变得更聪明。

## 公司基本面

| 维度 | 信息 |
| --- | --- |
| 法律实体 | Agentik, Inc. dba Cleric |
| 成立时间 | 2023 |
| 总部 | San Francisco |
| 团队规模 | 1-10 人 |
| 总融资 | $9.8M (两轮 Seed) |
| Seed 1 (2024.03) | $4.3M，Zetta Venture Partners 领投 |
| Seed 2 (2025.12) | $5.5M，Vertex Ventures US 领投，Zetta 跟投 |
| 估值 | ~$20M (2025 初估计) |
| 荣誉 | Gartner Cool Vendor 2025 (AI for SRE and Observability) |

## 创始团队

**Shahram Anver (CEO)** 此前在 Gojek 工作，亲历了大规模分布式系统运维的痛苦。LinkedIn 上的推荐描述他兼具技术深度和 people skills。

**Willem Pienaar (CTO)** Georgia Tech 背景。创建了开源 Feature Store 项目 [Feast](https://github.com/feast-dev/feast)，被 Cloudflare、Discord、Robinhood、Shopify、Twitter 等公司采用。此前在 Tecton 任 Principal Engineer / 开源工程负责人，更早在 Gojek 从零搭建了 ML Platform 团队。Willem 在 MLOps 社区非常活跃，是多次演讲嘉宾。

两人的共同经历是 Gojek，一个东南亚的超级 App（Decacorn 级别）。在那里他们亲眼目睹了产品团队和平台团队在管理庞大基础设施时的困境，这成为创建 Cleric 的直接动机。

## 技术架构

### 核心组件

Cleric 的系统可以拆成四个模块：

**1. Knowledge Graph（环境模型）** 自动构建组织内的基础设施关系图：团队、集群、VM、服务依赖、部署历史。采用分层图架构（Layered Graph），底层是高置信度的确定性层（比如直接 walk K8s 集群得到的拓扑），上层是更模糊的推断层（比如 config map 中引用了另一个服务的 IP）。

树形结构为：Cloud Project → Network/Region → K8s Cluster → Node → Container → Pod → Process → Code。同时存在跨层的横向关联（代码引用的 IP 属于某个云服务）。

**2. Reasoning Engine（推理引擎）** Agent 的核心循环：Plan → Execute → Reflect。收到告警后，生成多个假设（hypothesis），并行展开调查分支。每个分支调用工具获取信息，推理后继续深入或剪枝。产出带置信度评分的根因诊断和 hypothesis tree，让工程师能看到完整的推理路径。

**3. Memory System（三层记忆）** 这是 Cleric 最核心的差异化设计：

*   **System State Memory**：即 Knowledge Graph，生产环境的实时状态
    
*   **Procedural Memory**：程序性知识，类似"怎么骑自行车"。包括 runbook、流程文档、以及从历史调查中自动提取的可复用诊断技能（Self-Harvested Skills）
    
*   **Episodic Memory**：事件性记忆，"上次黑五集群挂了我们怎么处理的"。每次调查的完整上下文和结果
    

**4. Learning Module（学习模块）** 三个学习原则驱动：

*   **Correction-Based Learning**：用户纠正 Agent 的错误理解，形成 persistent memories。用户评分反馈。系统从交互中自动提取程序性模式，编码为可复用 procedures
    
*   **Visible Improvement**：三个维度保证用户能感知到学习效果。Persistence（同一场景下应用学到的知识），Compounding（泛化到相关但不同的场景），Visibility（推理时显式展示用了哪些知识）
    
*   **Ambient Learning**：持续观察生产活动、告警频道中的工程师行为，不需要显式调用就能吸收上下文
    

### 技术路线选择

*   **Context Engineering > Fine-tuning**：不做模型微调，依赖上下文工程。理由是更新延迟低、能直接受益于基础模型的升级
    
*   **Read-only by default**：默认只读接入生产环境，通过 API 集成而非安装 Agent。逐步建立信任后可以扩展权限
    
*   **SOC 2 Type II 合规**
    
*   **VPC 部署**：Agent 部署在客户的 VPC 内
    

### 集成生态

Slack、Kubernetes、Datadog、Grafana、Prometheus、PagerDuty、Confluence、Google Cloud Platform、Elastic 等 10+ 工具。

## Case Study: BlaBlaCar

### 背景

BlaBlaCar 是法国第一家独角兽（2015），社区型出行平台，覆盖 21 个国家。全容器化 K8s 架构 + Istio 服务网格，200+ 工程师，每天 200+ CI/CD 部署，SRE 团队只有 5 人。

### 痛点

*   高紧急度 incident 的 MTTR 接近 2 小时
    
*   告警是症状级别的，不指向根因
    
*   跨服务复杂度高，多个团队同时检测到同一问题但无法定位源头
    
*   200+ 工程师的 K8s / SRE 成熟度参差不齐
    
*   Alert fatigue
    

### 部署节奏

三阶段渐进式推出：

*   Phase 1 (2024.08): SRE helpdesk + 内部 Chaos App（K8s 模拟故障）
    
*   Phase 2 (2024.10): DBRE 团队告警频道，Level 1 数据库告警响应
    
*   Phase 3 (2025.01+): IAM 团队和更多平台团队
    

### 定量结果 (Q1 2025)

*   2,039 个告警被调查，月均 ~1,400（总告警量的~10%）
    
*   85.6% 高置信度 findings
    
*   78% 调查产出至少一个可操作洞察（部署失败、Pod crash、扩缩容问题、Job 失败）
    
*   复杂场景（SLO burn-rate、异常检测）的有用率 50%
    
*   IAM 团队 6 周达到与 on-call 工程师匹配的一致质量
    
*   Engage 团队 3 周达到一致质量
    

### 定性价值

*   高级工程师：每个告警节省数分钟的日志分析时间
    
*   初级工程师：显著缩短调查时间，立即缩小搜索空间
    
*   跨服务智能：有效识别服务间影响传导，关联到最近部署
    
*   发现集群级不稳定：同时节点关闭、不可用副本从 2 增至 5（15 分钟内）、14 分钟遥测缺口
    

## 竞品格局

AI SRE 赛道正在快速形成，可以按"平台型"和"独立 Agent 型"分两类看。

### 独立 AI SRE Agent

| 产品 | 核心差异 | 阶段 |
| --- | --- | --- |
| **Cleric** | 自学习 + operational memory + hypothesis tree | Seed, $9.8M |
| **Traversal** | 因果 ML + 强化学习做 RCA，>90% 准确率的 Bullseye RCA | 未公开 |
| **Hawkeye (Neubird)** | 向量数据库嵌入 + 告警折叠，$25/次调查 | 未公开 |
| **Phoebe AI** | 主动式监控，不依赖告警触发 | 未公开 |
| **Resolve AI** | 多 Agent 平台，覆盖 incident/成本/开发 | 未公开 |
| **Anyshift** | 基础设施版本图 + GraphRAG | 未公开 |

### 平台内置 AI SRE

| 产品 | 核心差异 | 定价 |
| --- | --- | --- |
| **Datadog Bits AI** | 直接访问完整遥测数据，零配置 | ~$30/次调查 |
| **PagerDuty GenAI** | 4 个专项 Agent（SRE/Scribe/Shift/Insights），700+ 集成 | $415+/月 |
| **Metoro** | eBPF 原生插桩 + 自动生成修复 PR | 平台捆绑 |
| **Rootly AI** | 原生 incident 管理 + 历史事件上下文 | 联系销售 |
| **Incident.io** | Slack-native 工作流 + 免费层 | 免费 / $15/人/月 |

### 已被收购

**Shoreline** (2024.06 被 NVIDIA 以 ~$100M 收购): 重点是自动化修复（automated remediation），不只是诊断。创始人 Anurag Gupta 是 AWS 老人。

### Cleric 的竞争位置

Cleric 选择了一个很有意思的切入点：不做告警聚合（BigPanda 的活），不做自动修复（Shoreline 的活），不做 full-stack observability（Datadog 的活）。它专注于"调查"这个环节，核心壁垒是 operational memory 的积累效应。

这个定位的优势是安全（read-only），易于采纳（不需要替换任何现有工具），能与 PagerDuty/Datadog 互补。劣势是价值天花板：如果只能"建议"而不能"行动"，对于高度自动化的团队来说吸引力有限。

## 核心洞察和判断

### Cleric 做对了什么

**1. Memory 架构是真正的技术壁垒** 三层 memory（System State / Procedural / Episodic）加上分层 Knowledge Graph 的设计，不是简单的 RAG。它区分了"环境是什么样的"、"团队通常怎么做"、"上次遇到类似问题怎么处理的"这三种本质不同的知识。这让 Agent 能在面对新问题时做有意义的类比推理，而不只是模式匹配。

**2. Trust-building 路径设计成熟** 从 read-only 开始，phase-based 部署，先用 Chaos App 做验证，再扩展到真实告警。BlaBlaCar 的案例中，从 2024.08 到 2025.03，7 个月只扩展到 5 个团队。这个速度看起来慢，但对于 production environment 来说是正确的节奏。

**3. 创始团队的 domain expertise** Willem 创建 Feast 的经历说明他理解"大规模 ML 系统的工程化"问题。两人在 Gojek 的经历说明他们理解"真正大规模生产环境的运维痛苦"。这不是一个凭空想象的产品。

### 值得关注的风险和限制

**1. 数据质量瓶颈** Cleric 的诊断深度完全取决于集成覆盖度和遥测质量。缺少日志或指标不完整的服务，Agent 只能基于片段推理。这不是 Cleric 的技术问题，是所有集成式 AI SRE 的结构性限制，但像 Datadog Bits AI 这种内置方案天然没有这个问题。

**2. Read-only 的价值天花板** 当前只能"建议"不能"行动"。BlaBlaCar 的 roadmap 里提到了 Safe Automatic Remediation 作为长期目标，但这条路从 read-only 走到 write 需要跨越的信任和技术门槛都很高。

**3. 规模问题** $9.8M 的 Seed 轮，1-10 人的团队，面对的竞争对手包括 Datadog（$17B+ 市值）、PagerDuty（$2B+ 市值），还有 NVIDIA 收编的 Shoreline。资金和人力的差距是数量级的。Cleric 需要在 operational memory 这个差异化点上跑得足够快。

**4. Context Window 的隐性约束** 采用 context engineering 而非 fine-tuning，意味着知识库增长后会遇到 context window 上限。如何高效检索和组装上下文，在客户规模增长后会成为工程挑战。

**5. 50% 复杂场景有效率** BlaBlaCar 数据中，对简单告警（pod crash、部署失败）效果好（78%），但 SLO burn-rate 和异常检测这类复杂场景只有 50% 有用率。复杂场景恰恰是高价值场景，这个数字还有很大提升空间。

### 对 AI SRE 赛道的观察

这个赛道正在分化成三个子方向：

*   **诊断层**（Cleric, Traversal）: 搞清楚出了什么问题
    
*   **行动层**（Shoreline/NVIDIA, Metoro）: 自动修复
    
*   **聚合层**（BigPanda, PagerDuty AIOps）: 降噪和编排
    

长期来看，winner 可能需要覆盖诊断 + 行动的完整闭环。Cleric 从诊断切入是安全的起步，但需要在 memory 壁垒足够高之前向行动层延伸。

## 资料来源

*   [Cleric 官网](https://cleric.ai/)
    
*   [BlaBlaCar Case Study](https://cleric.ai/resources/case-studies/how-the-worlds-leading-community-based-travel-network-is-transforming-incident-response-with-ai)
    
*   [Vertex Ventures 投资文章](https://medium.com/vvus/reinventing-sre-with-ai-our-investment-in-cleric-6c2ced0b3f12)
    
*   [Willem Pienaar: Towards Self-healing Autonomous Software (MLOps Community)](https://home.mlops.community/public/videos/cleric-ai-sre-towards-self-healing-autonomous-software-willem-pienaar-agents-in-production)
    
*   [Willem Pienaar Podcast: Building an Autonomous AI SRE (Spotify)](https://creators.spotify.com/pod/profile/mlops/episodes/Insights-from-Cleric-Building-an-Autonomous-AI-SRE--Willem-Pienaar--290-e2unikg)
    
*   [ZenML: Building Stateful Learning Agents for Production SRE](https://www.zenml.io/llmops-database/building-stateful-learning-agents-for-production-sre)
    
*   [Top 12 AI SRE Tools in 2026 (Metoro)](https://metoro.io/blog/top-ai-sre-tools)
    
*   [SiliconANGLE: Cleric launches AI agent](https://siliconangle.com/2025/12/09/cleric-launches-ai-agent-uplevel-site-reliability-intelligent-automation/)
    
*   [TechFundingNews: Cleric grabs $4.3M](https://techfundingnews.com/cleric-grabs-4-3m-for-first-24-7-autonomous-ai-site-reliability-engineer/)