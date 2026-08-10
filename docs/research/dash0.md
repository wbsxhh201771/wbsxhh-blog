---
sidebar_position: 3
title: Dash0 深度调研
---

# Dash0 深度调研

> 调研时间：2026-04-09 目的：全面了解 Dash0 的技术架构、产品设计、团队背景和竞争策略，为自建 SRE Agent 提供参考

---

## 一、公司背景

### 1.1 创始团队

Dash0 于 2023 年 5 月创立，总部纽约。核心团队是前 Instana 的创始班底。Instana 是一家 APM 公司，2015 年创立，2020 年被 IBM 以约 $5 亿收购。

五位创始人：

| 姓名 | 角色 | 背景 |
| --- | --- | --- |
| Mirko Novakovic | CEO | Instana 创始人，此前创办 codecentric（增长到 300 人）。60+ 家创业公司天使投资人 |
| Ben Blackmore | CTO | IBM Instana 和 steadybit 的 Staff Engineer，与 Mirko 合作 13 年 |
| Michele Mancioppi | Chief Architect / Head of Product | Tilburg CS PhD，前 Instana 高级技术产品经理，活跃的 OpenTelemetry 贡献者 |
| Miel Donkers | Founding Engineer |  |
| Marcel Birkner | Founding Engineer |  |

Novakovic 和部分创始人在创立 Dash0 前还在 ClickHouse 工作过，帮助构建其云产品。这直接影响了 Dash0 的存储选型。

### 1.2 创业动机

Mirko 对 Instana 收购的态度很直接：

> "I felt like I'd been defeated. I felt like I didn't finish my job."

> "I didn't start another observability company just because I needed another exit. I started Dash0 because I want to finish the job this time."

创业论点是：observability 仍然没有被解决。平台是孤岛式的（logs、metrics、traces 分散在不同存储，用不同语言查询），agents 是 proprietary 的，数据量不断增长但无法转化为洞察，账单在不透明的定价模型后面爆炸式增长。

团队给自己设了一个硬指标：第一年达到 $1M ARR，否则关门。最终超额完成。

### 1.3 融资与增长

| 轮次 | 时间 | 金额 | 领投 |
| --- | --- | --- | --- |
| Seed | 2024.11 | $9.5M | Accel |
| Series A | 2025.10 | $35M | Accel + Cherry Ventures |
| Series B | 2026.03 | $110M | Balderton Capital |

总融资 $155M，Series B 估值 $10 亿（独角兽）。其他投资方包括 DIG Ventures、DTCP Growth、Deutsche Telekom、July Fund、T.Capital。天使投资人包括 Snyk 联合创始人 Guy Podjarny 和 Vercel CEO Guillermo Rauch。

增长曲线：产品 2024 年 11 月上线，3 个月 30 个付费客户，6 个月 100 个，10 个月 300+，Series B 时 600+（含 Lumigo 收购带来的客户）。团队约 126 人。客户包括 Zalando、Taco Bell、The Telegraph、Porsche Digital、EVgo。

2026 年 2 月收购 Lumigo（以色列，专注 AWS Lambda 和 serverless observability），扩展到 Kubernetes + serverless + 托管云服务 + LLM 应用的统一可观测性。

### 1.4 时间线

| 日期 | 事件 |
| --- | --- |
| 2015 | Instana 创立 |
| 2020 | Instana 出售给 IBM (~$500M) |
| 2023.05 | Dash0 创立 |
| 2023.11 | OTelBin 开源上线 |
| 2024.11 | $9.5M Seed，产品正式发布 |
| 2025.10 | $35M Series A，SIFT 和 Agent0 发布 |
| 2026.02 | 收购 Lumigo |
| 2026.03 | $110M Series B，$1B 估值 |

---

## 二、产品架构

### 2.1 SIFT 框架：数据治理先于 AI

Agent0 构建在 SIFT 框架之上。Dash0 的核心观点是：observability 行业陷入了"more telemetry is better"的范式陷阱，找根因如同在不断膨胀的草垛里找针。SIFT 在 AI 介入之前先压缩数据空间。

**S: Spam Removal（垃圾过滤）**

点击式操作自动生成 OTTL（OpenTelemetry Transformation Language）规则，在 ingestion pipeline 中执行。遥测数据在存储前和计费前就被丢弃。覆盖日志（按属性过滤）、指标（按名称或属性值过滤，如 `deployment.environment.name!=prod`）、spans（如丢弃所有成功的 K8s 健康检查探针，只保留失败的）。规则在 Dataset 级别指定，可导出为 OTelBin 配置（等效 OTTL 表达式），供自托管 Collector 使用。

未来迭代计划用 AI 主动建议应移除的无用遥测数据。

**I: Improve Telemetry（遥测增强）**

三个机制。Log AI 自动结构化非结构化日志并分配 severity 级别（98%+ 检测率，0% 误报率），采用混合方法：模型 + 语义感知启发式规则，配合 ValKey 缓存实现模式复用。处理在 ingestion pipeline 中运行。当日志格式变化时，pattern 自动更新。遵循 graceful degradation：extraction 失败时无副作用。评估用社区 + 私有数据集，核心指标是"severity patch coverage"。

另外两个机制：semantic convention 自动对齐（元数据对齐 OTel 标准）、pattern recognition（识别日志和 trace 中的重复模式）。

**F: Filtering & Grouping（过滤与分组）**

每个 tag、参数和 UI 元素都可交互。Grouping 按选定属性聚合遥测数据（如按 `service.name` 分组 spans），用 RED Charts（Rate, Errors, Duration）替代 heatmaps。Drill-down 按钮施加过滤器并切换到特定服务的详细 RED charts。UX 强制迭代式数据集缩减：总览 → 优先级排序 → 详细调查。

**T: Triage（分诊）**

统计比较引擎。用户在数据区域画选择框，Dash0 比较选择区域内外的 span 属性。四种比较模式：Everything Else（选区 vs 所有剩余）、Same Timeframe（异常值检测）、Everything Before（spike 来源分析）、Attribute Analysis（模式聚类）。目前仅支持 tracing（beta），计划扩展到 logs 和 metrics。

### 2.2 Agent0 多智能体架构

Agent0 不是单一 chatbot，而是一组联邦式专业 agent。核心路由机制：用户提交请求 → Generalist（通才路由器）分析意图 → 分发给最合适的专业子 agent → 每个 agent 有独立的 tool set → 所有 tool 调用完全透明。

六个专业 agent：

**The Seeker（事件分诊/根因分析，蓝色）**

四阶段调查流程：

1.  Context Gathering：识别受影响服务，获取告警触发信息
    
2.  Telemetry Correlation：同时评估错误率、请求量、延迟（不孤立看单个指标）
    
3.  Signal Analysis：跨 logs + metrics + traces 联合检查，拉取错误日志和 trace，执行 span 异常值和错误过滤
    
4.  Change Detection：关联近期系统变更与事件时间
    

输出结构化的 Issue Analysis：错误率、识别出的根因、受影响的操作、修复建议。

**The Oracle（PromQL 查询，白色）**

超越简单的 text-to-PromQL 翻译。利用完整的环境上下文（实际可用的 metrics 和 attributes）生成查询，inline 执行并返回图表，附带 function 选择的解释。不是模板引擎，而是从实际数据出发推理。

**The Pathfinder（接入引导，绿色）**

生成针对性的 step-by-step instrumentation 指南：精确的代码片段、环境变量、OTel agent 配置。从 OpenTelemetry 官方文档中提取信息。目标是将接入时间从数小时压缩到分钟级。

**The Threadweaver（链路分析，黑色）**

将分布式 trace 重构为人类可读的因果叙事。检测实际延迟源头（通常是下游依赖而非表面嫌疑者）。将密集的 trace waterfall 转化为直白的解释。

**The Artist（仪表盘/告警，无色/Artifact）**

默认应用 RED 方法（Rate, Errors, Duration）。生成 Perses 兼容的 YAML dashboard 定义和 SLO 式告警规则。输出是 infrastructure-as-code 就绪的，可直接 Git 管理。

**The Lookout（前端/会话分析，2026.02 新增）**

专注前端性能分析。访问 web events、Core Web Vitals（CLS、INP、LCP）、session 数据、请求性能，以及前端事件与后端 trace 之间的跨信号关联。支持对话式逐步深入。

### 2.3 上下文捕获机制

Agent0 通过两种方式自动获取上下文，而非要求用户手动提供：

*   按钮触发：在特定视图（如告警详情页）上，按钮预填 prompt，包含相关服务、时间范围、告警信息
    
*   命令面板（Cmd+K / Ctrl+K）：自动捕获当前视图上下文（服务、时间范围、过滤器）
    

响应中包含可点击的 actionable tags（服务名、trace ID、指标名），点击后打开上下文侧边栏，无需离开对话。

### 2.4 外部集成

Agent0 不只在 Dash0 UI 内工作。与 Linear 的双向集成：用户在 Linear issue 中 @Dash0，触发 webhook → Dash0 认证 → 创建调查 session → 将结果作为 agent activities 流式回传，带 deep links 回到 Dash0 的完整调查。

---

## 三、存储架构

Dash0 以 ClickHouse 作为所有遥测数据的唯一主存储（PostgreSQL 仅存客户配置）。这是一个关键的技术决策，直接源于创始团队在 ClickHouse 公司的工作经历。

### 3.1 主键设计

采用 `(ResourceHash, Timestamp)` 排序，而非常见的 timestamp-first 方案。ResourceHash 从所有 OTel resource attributes 生成。

设计理由：按服务过滤是最常见的查询模式（"给我 service-auth 最近 1 小时的错误日志"），ResourceHash-first 意味着同一服务的数据物理相邻，需要扫描的 marks 更少，压缩率显著提升。时间范围查询通过 daily partition 弥补。

### 3.2 指标元数据去重

Gauge 表只存 MetricHash + 时间戳 + 值。MetricName、Description、Unit 等静态字段存在独立的元数据表中，使用 AggregatingMergeTree 引擎持续去重。这避免了每个数据点重复存储静态元数据。

### 3.3 存储分层

1-2 天热数据存本地磁盘，更早的数据通过 TTL 自动迁移到 S3，外加查询缓存层减少 S3 GET 开销。

### 3.4 采样查询优化

排序键为 `(ResourceHash, toStartOfHour(Timestamp), xxh3(SpanId))`，配合 Timestamp 上的 minmax 二级索引实现高效采样查询。

### 3.5 高基数处理

公开信息有限。Beta 更新中提到"key/value guidance for high cardinality fields"和"semantic sorting"，暗示他们针对高基数属性构建了索引策略。

### 3.6 OTel-Native 存储

数据以 OTLP 原生格式存储，没有到私有 schema 的转换损失。支持原生 OTel histogram（不转换为其他格式）。Semantic filtering 理解属性语义，意味着 schema 保留了 OTel attribute types。

---

## 四、OpenTelemetry-Native 的含义

Dash0 对"OTel-native"的定义比市场上大多数厂商严格得多。他们定义了 11 项标准来判断一个平台是否真正 OTel-native。

### 4.1 数据模型层面

OTel 的数据模型和 semantic conventions 是 Dash0 的基础数据模型，不是一个输入适配器。数据以 OTLP 原生格式存储在 ClickHouse 中，没有转换损失。Resource-Centric 视图基于 OTel resource 概念，对齐云原生应用的多层抽象（pod、service、deployment 等）。

### 4.2 跨信号关联

利用 OTel 的 context propagation，日志直接关联到产生它的 span，一键跳转到完整 trace。指标、日志、链路之间可以在 ClickHouse 中直接 JOIN（得益于单一存储）。

### 4.3 与"集成 OTel"的本质区别

Dash0 博客详细阐述了两者的差异：

*   Native 平台存储原始 OTLP；Integration 平台转换为私有 schema，丢失上下文
    
*   Native 平台保持 OTel 术语；Integration 平台强制术语翻译
    
*   Native 平台的属性不额外收费（按数据点计费，不按字节）；Integration 平台的 OTel 数据可能被当作昂贵的自定义数据处理
    

### 4.4 OTel 作为 AI 的加速器

来自 Tessl 播客的洞察：LLM 天然理解 OpenTelemetry，因为 OTel 是开源的且文档完善，模型训练数据中包含其 spec：

> "OpenTelemetry turned out to be really useful because all the models by default understand the format."

Ben Blackmore（CTO）在 Code RED Live 中补充：OpenTelemetry semantic conventions 对 AI 系统来说是"a true superpower"。

这意味着使用 OTel 格式存储的数据天然对 LLM 友好，不需要额外的格式适配层。

---

## 五、Perses 而非 Grafana

### 5.1 战略考量

Perses 是 CNCF sandbox 项目，定义了标准化的开放 dashboard 规范。Grafana dashboards 使用 Grafana Labs 控制的私有 JSON schema。选择 Perses 避免了对竞争对手格式的依赖。

### 5.2 技术优势

Dashboard-as-code 原生支持：Perses 提供 SDK 做 programmatic dashboard 管理、CLI（percli）做 CI/CD 集成、static validation 配合可扩展的 lint 规则。这和 Dash0 的 infrastructure-as-code 哲学一致。

Kubernetes-native：Perses operator 提供 `PersesDashboard` CRDs。Dash0 的 operator 监听这些 CRDs 并通过 API 同步到 Dash0，实现 GitOps 工作流（dashboards 在版本控制中定义，声明式应用）。

可嵌入：Perses 提供 npm packages 在外部应用中嵌入 panels。

### 5.3 迁移路径

Perses 包含从 Grafana dashboards 导入的工具，降低了切换成本。Agent0 的 The Artist 直接生成 Perses-compatible YAML，输出可直接提交到 Git。

---

## 六、MCP Server 与开源生态

### 6.1 MCP Server

仓库 `dash0hq/mcp-dash0`（MIT 许可），是一个远程托管的 MCP server，使用 Streamable HTTP 传输（旧客户端可通过 `npx mcp-remote` 回退）。不是本地安装的二进制文件。通过 Bearer token 认证。

设计哲学是 Dash0 API 的薄桥接层，tools 由 LLM 连接时动态发现。支持导航 OpenTelemetry resources、调查 incident、查询 metrics/logs/traces。

与 Datadog MCP Server 的区别：Dash0 是远程托管（无需本地安装），数据严格限定在 OTel-native 范围内；Datadog 是本地安装，暴露更广的私有 API 表面。

### 6.2 Agent Skills

`dash0hq/agent-skills` 仓库（32 stars）提供了一种互补方案：为 AI coding assistants（Claude Code、Cursor 等）打包的 OTel 领域知识。四个 skills：

*   `otel-instrumentation`：多语言 instrumentation 指南
    
*   `otel-semantic-conventions`：属性命名规范
    
*   `otel-collector`：pipeline 配置
    
*   `otel-ottl`：transformation language
    

通过 `npx skills add dash0hq/agent-skills` 安装。Skills 内容是 vendor-neutral 的，但默认的 exporter 配置指向 Dash0。这个策略值得注意：在任何商业关系建立之前，通过开源 skills 将 Dash0 的最佳实践嵌入开发者工作流。

### 6.3 完整开源生态

| 项目 | Stars | 用途 |
| --- | --- | --- |
| OTelBin (otelbin.io) | 525 | OTel Collector 配置可视化/验证，Apache 2.0 |
| dash0-operator | 50 | K8s auto-instrumentation operator |
| agent-skills | 32 | AI coding assistant 的 OTel skills |
| dash0-sdk-web | 16 | 浏览器遥测收集 |
| opentelemetry-js-distribution | 6 | Node.js OTel distribution |
| dash0-cli | 10 | CLI |
| terraform-provider-dash0 | 3 | IaC |
| mcp-dash0 | 2 | MCP server |
| dash0-semantic-conventions | 3 | Dash0 扩展的 OTel semconv |

开源策略服务三个功能：

1.  **获客漏斗顶部**：OTelBin 是最高曝光的项目，降低 OTel 采用门槛，扩大 Dash0 的潜在市场
    
2.  **零锁定证明**：K8s operator、Terraform provider、CLI、Perses dashboard 导出都证明 Dash0 配置可移植。Spam filter 规则导出为 OTTL，dashboards 导出为 Perses JSON，告警规则使用 PrometheusRule CRDs
    
3.  **开发者生态捕获**：agent-skills 是最具战略意义的新项目
    

---

## 七、定价模型

纯用量计费，2025 年 1 月取消了之前 $50/月的基础订阅费：

| 数据类型 | 单价 |
| --- | --- |
| Metric Data Points | $0.20/百万 |
| Spans / Span Events | $0.60/百万 |
| Log Records | $0.60/百万 |

关键特性：

*   无 per-seat 费用，全团队使用
    
*   无 AI 使用成本（Agent0 不额外收费）
    
*   不使用不收费
    
*   14 天免费试用，试用期内无用量限制
    
*   可设置月度预算上限，接近时预警
    
*   按数据点计数，不按字节，所以丰富的 OTel 属性不额外收费
    
*   可通过 AWS Marketplace 购买
    
*   单条记录 50MB 上限
    

举例：1M logs + 2M spans + 4M metric data points = $0.60 + $1.20 + $0.80 = $2.60。

### 7.1 "Kill the Bill" 挑战

面向年度 observability 账单超过 $50K 的公司：Dash0 承诺展示同等遥测量下 50% 的成本节省，否则向慈善机构捐赠 $10K。这是获客手段，暂无公开的成本节省案例数据。

### 7.2 与 Datadog 定价对比

Datadog 有 per-host 费用、per-GB 摄入费、indexed spans 费、多个附加产品各自计费，账单难以预测。Dash0 引用 Coinbase 每年付给 Datadog $65M 作为震撼数字。Dash0 的模型显著更简单，且 OTel semantic conventions 让客户能精确看到哪个服务/开发者/应用产生了多少成本。

---

## 八、竞争策略

### 8.1 核心定位

Mirko 不回避指名竞争：

> "We're building Dash0 to win the market. To beat Datadog and to build a product that can rise above the legacy vendors."

> "Now, with Agent0, we're taking the next leap: turning that data into action. The $110 million we're announcing today is how we bring autonomous operations to every engineering team in the world, before our competitors even understand what's happening to them."

同时承认对手的实力：

> "Datadog is the leader in this space. They have an amazing product, amazing execution."

### 8.2 vs Datadog

核心叙事：Datadog 是"proprietary ecosystem"配"obscure & expensive pricing"。具体差异点：

*   Dash0 客户只为过滤后的遥测付费；Datadog 用户为所有摄入数据付费（无论是否过滤）
    
*   Dash0 的 OTel 是 native 存储；Datadog 将 OTel 数据转换为内部格式（所谓"OTel Tax"）
    
*   Dash0 强调直觉式 UI；Datadog 被定位为"steep learning curve requiring dedicated specialists"
    

### 8.3 vs Grafana

通过 Perses 选择和开放标准叙事隐性竞争。Grafana dashboard 格式是私有的；Perses 是 CNCF 标准。Grafana Cloud 需要拼装多个后端（Loki、Mimir、Tempo）；Dash0 是统一的。攻击力度弱于对 Datadog。

### 8.4 差异化总结

与 Datadog Bits AI、PagerDuty 等相比，Agent0 的差异化集中在几个层面：

**可解释性优先，而非黑盒自动化。** Bits AI 强调 autonomous，Agent0 强调 augmentation。Agent0 不自动修改生产配置，暴露完整推理过程。设计哲学的核心表述是："you cannot act on an answer unless you understand where it came from."

**联邦专业 agent 而非通用 chatbot。** 大多数竞品是单一 AI 助手。Dash0 拆分为多个专门化的 agent，每个有独立工具集和领域知识。路由层自动分发。每个 agent 可针对性优化。

**原生 OTel 而非事后集成。** agent 生成的查询是 PromQL，dashboard 导出为 Perses 格式，接入指导基于标准 Collector pipeline，所有产出可移植。

**成本模型透明。** Bits AI 每次告警触发都会自动运行查询和分析，叠加在 Datadog 复杂定价之上。Dash0 按数据点计费，没有隐藏的 AI 使用成本。

---

## 九、创始人对 AI 的坦诚看法

这一节整理自创始人在播客和博客中的公开发言，是他们最坦诚也最有参考价值的部分。

### 9.1 对 AI chatbot 的批评

Mirko 对早期 AI-in-observability chatbot 不以为然：

> "I'm not here to reinvent Clippy. Engineers don't need a chatbot explaining the obvious. They need tools that work seamlessly in the background."

> "If a feature's selling point is that it is made with AI, it is probably not a great feature. AI is a powerful means to an end. And that end is Observability, simplified."

### 9.2 GenAI 做 RCA 的局限

坦率承认 GenAI：

> "not yet the silver bullet for root cause analysis in large, connected microservice environments."

Dash0 因此采用 GenAI + ML + 统计 + 用户驱动探索的组合，而非单纯依赖 LLM。

### 9.3 成本是真实约束

Principal AI Engineer Lariel Fernandes：

> "A very common challenge of all AI in observability is that things get expensive really fast. Telemetry data can be very token hungry. It becomes very verbose, which means you'll pay a lot for processing those tokens, it becomes slow, it starts increasing the likelihood of hallucinations."

百万级/分钟的日志量下对每条调用 LLM 成本不可承受，所以实现了 caching 和分布分析来最小化昂贵操作。

### 9.4 可靠性是核心挑战

Ben Blackmore（CTO）谈反复运行 RCA 的结果：

> "Getting it more reliable and getting more consistent. That is one of the core challenges."

结果在推理步骤上有差异但通常收敛到正确答案。Agent 有时生成无效查询，需要人工监督。

### 9.5 什么有效

Agent0 原型让 Mirko 印象深刻：

> "In a minute it figures out what could take you hours or days."

关键设计经验：直接暴露原始 API 给 LLM 效果很差（"the model had no idea what to do with it"），将功能重新包装为人类建模的工作流后效果显著提升。这和人类排查问题的方式平行。

### 9.6 agent-first 设计反转

来自 Tessl 播客，Mirko 描述了 UX 设计的反转：不再是先为人类设计再加 AI，而是先问"agent 能做这个工作吗"：

> "Charts are good for users, not good for agents. Agents look at the underlying data and do deep analysis."

### 9.7 "2-3 人问题"

> "Only 2-3 people in most companies can truly debug production. That knowledge lives in their heads and disappears when they leave."

Agent0 的核心目标是民主化生产环境调试能力。

### 9.8 平台存在性危机

Mirko 提出了一个深层担忧：如果用户主要通过外部 AI agent（而非 vendor UI）与 observability 交互，平台有变成"只是一个数据库"的风险，从价值角度来看这并不值钱。

### 9.9 对 coding agent 的使用体验

Ben Blackmore 测试了 Cursor、Windsurf、Claude Code：

> "Unfortunately I have to say that we are not getting a 10x boost out of it."

发现开发者会同时开多个 PR 但不完成，造成瓶颈。AI 对 scaffolding 和 integration writing 有用，对 creative coding 帮助有限。

---

## 十、Conference Talks 与技术分享

### 10.1 Michele Mancioppi（Chief Architect）

*   KubeCon EU 2025 (London)："The Art and Craft of No-touch Instrumentation"
    
*   KubeCon NA 2024 (Atlanta)：与 Antoine Toulme 和 Jason Plumb 联合分享 OTel Injector（LD\_PRELOAD、ELF headers、Zig 实现）
    
*   KubeCon NA 2025 (Atlanta)："Instrumentation Score: The Difference Between Telemetry and Good Telemetry"
    
*   O11ycast Podcast #68：讨论让非专家也能使用 observability
    
*   Dash0 Agent0 Webinar：walkthrough agentic AI 在 Dash0 中的实现
    

### 10.2 Mirko Novakovic（CEO）

*   PlatformCon 2024："OpenTelemetry Native Observability"
    
*   CaSE Podcast #57："Waves of Innovation and Observability Product Management"
    
*   Slush (Helsinki)：speaker
    
*   Tessl/AI Native Dev Podcast #92："From IBM Acquisition to AI-Native Observability"（2026.02）
    
*   Startup Insider podcast：讨论一周内收到七份 term sheet
    
*   Unicorn Bakery podcast：多次出现，讨论 GTM、销售扩展、Instana 退出
    

### 10.3 Kasper Borg Nissen（DevRel，KubeCon 2024 联合主席）

*   KubeCon EU 2025 Keynote："The Observability Platform Engineering Advantage: From Zero-Code to Monitoring as Code"
    
*   KubeCon Japan 2025："Debugging OpenTelemetry: Ensuring Your Observability Signals Are Spot On"
    
*   KubeCon EU 2026 (Amsterdam)：Dapr+OTel workflows 和 K8s ingress controllers 中的 OTel
    

---

## 十一、对自建 Agent 的参考价值

### 11.1 SIFT 框架的启示

在做 AI 之前先做数据治理。我们的 hubble 作为统一监控入口，可以参考 SIFT 的 Spam Removal 思路：在告警到达 agent 之前，先用规则层过滤掉已知的噪音（抖动类告警、周期性波动、已有在跟的治理项）。这和我们 Q1 报警治理系统的降噪方向一致，可以作为 agent 的前置环节。

### 11.2 Agent0 的联邦 Agent 设计

和我们推荐的 Orchestrator + Specialist 架构高度吻合。每个 specialist 有独立 tool set 和领域知识，通过路由层分发。值得注意的具体做法：

*   上下文自动捕获（告警详情页按钮预填 prompt、命令面板捕获当前视图上下文），减少用户需要提供的信息
    
*   tool 调用完全透明，用户可检查具体查询和数据
    
*   PromQL 作为查询接口（标准化，而非私有格式）
    

### 11.3 OTel-Native 对 AI 的加速效果

Dash0 的发现值得深思：OTel 格式对 LLM 天然友好，因为训练数据中包含 OTel spec。如果我们的遥测数据逐步迁移到 OTel 格式，agent 的理解能力会天然提升，不需要额外的格式适配工作。

### 11.4 Log AI 的混合方法

Dash0 的日志分类不是纯 LLM 方案，而是模型 + 语义感知启发式规则 + ValKey 缓存的混合体。98%+ 检测率、0% 误报。这对我们处理日志碎片化问题有参考价值：不需要统一日志格式，可以在 agent 的数据接入层做智能分类和结构化。

### 11.5 "API 直接暴露给 LLM 效果很差"

Mirko 的经验：直接暴露原始 API 给 LLM，"the model had no idea what to do with it"。重新包装为人类建模的工作流后效果显著提升。这和 Datadog 的教训（直接包装 API 给 agent 用是不够的）一致。我们在设计 hubble MCP tool server 时，应该按调查工作流组织工具，而非按 API endpoint 映射。

---

## 参考来源

**播客：**

*   [Tessl/AI Native Dev #92: From IBM Acquisition to AI-Native Observability](https://tessl.io/podcast/92/)
    
*   [Code RED #31: Beyond Hype - The Real Impact of AI on Observability](https://www.dash0.com/podcast/31-code-red-live-beyond-hype-the-real-impact-of-ai-on-observability)
    
*   [Code RED #20: Behind the Screens with CTO Ben Blackmore](https://www.dash0.com/podcast/20-behind-the-screens-inside-dash0-with-cto-ben-blackmore)
    
*   [Code RED #1: Making Software That Doesn't Suck with Michele Mancioppi](https://www.dash0.com/podcast/1-making-software-that-doesn-t-suck-with-michele-mancioppi)
    
*   [Code RED #33: Inside the AI SRE Boom](https://www.dash0.com/podcast/33-inside-the-ai-sre-boom-anish-agarwal)
    
*   [CaSE Podcast #57](https://www.case-podcast.org/57-innovation-and-observability-product-management)
    
*   [Unicorn Bakery (德语)](https://www.unicornbakery.de/mirko-novakovic-dash0-verkaufen-deutsche-gruender-ihre-firmen-zu-frueh-muss-ich-als-gruender-in-die-usa-ziehen-um-dort-erfolg-zu-haben-9-stelliger-instana-exit-an-ibm/)
    

**博客：**

*   [Building Dash0: From Idea to Series A](https://www.dash0.com/blog/building-dash0-from-idea-to-series-a)
    
*   [AI in Dash0: Building the Future of Observability](https://www.dash0.com/blog/ai-in-dash0-building-the-future-of-observability)
    
*   [Introducing Agent0](https://www.dash0.com/blog/introducing-agent0-dash0-s-agentic-ai-platform-for-observability)
    
*   [Agent0 AI for SREs: 5 Capabilities](https://www.dash0.com/blog/agent0-ai-sre-agent)
    
*   [Introducing SIFT](https://www.dash0.com/blog/introducing-sift)
    
*   [Automated Log Classification Using AI](https://www.dash0.com/blog/automated-log-classification-using-ai)
    
*   [OTel-Native vs. Integrating OTel](https://www.dash0.com/blog/what-is-the-difference-between-being-opentelemetry-native-and-integrating-opentelemetry)
    
*   [Rethinking the Observability Market: $12B Estimate](https://www.dash0.com/blog/rethinking-the-observability-market-my-usd12b-estimate-for-2024)
    
*   [Why the OTel Batch Processor is Going Away](https://www.dash0.com/blog/why-the-opentelemetry-batch-processor-is-going-away-and-why-that-is-great-news)
    

**产品文档：**

*   [Agent0 Key Concepts](https://www.dash0.com/docs/dash0/ai/agent0/key-concepts)
    
*   [AI SRE Agent 产品页](https://www.dash0.com/ai-sre-agent)
    
*   [定价](https://www.dash0.com/pricing)
    
*   [集成](https://www.dash0.com/hub/integrations)
    

**新闻：**

*   [TechCrunch: Datadog challenger Dash0](https://techcrunch.com/2024/11/04/datadog-challenger-dash0-aims-to-dash-observability-bill-shock/)
    
*   [SiliconANGLE: $110M raise](https://siliconangle.com/2026/03/23/dash0-raises-110m-1b-valuation-change-cloud-observability-ai-agents/)
    
*   [The Next Web: Unicorn](https://thenextweb.com/news/dash0-110m-series-b-observability-unicorn)
    
*   [Balderton: Series B](https://www.balderton.com/news/dash0-raises-110m-series-b-at-1b-valuation-to-build-the-ai-nervous-system-for-production/)
    

**开源：**

*   [OTelBin (otelbin.io)](https://www.otelbin.io/)
    
*   [GitHub: dash0hq](https://github.com/dash0hq)
    
*   [MCP Server: dash0hq/mcp-dash0](https://github.com/dash0hq/mcp-dash0)
    
*   [Agent Skills: dash0hq/agent-skills](https://github.com/dash0hq/agent-skills)
    

**ClickHouse 存储：**

*   [Building an Observability Solution with ClickHouse at Dash0](https://clickhouse.com/blog/building-an-observability-solution-with-clickhouse-at-dash0)
    

---

_本文档基于 2026-04-09 公开信息整理。Dash0 处于快速发展期，建议持续跟踪其工程博客和 Code RED 播客。_