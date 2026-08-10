---
sidebar_position: 6
title: 字节跳动 SRE AI Agent 实践
---

# 字节跳动 SRE/Ops AI Agent 实践详解

> 调研时间：2026-03-25 来源：字节技术博客、NSDI/QCon/AiDD 会议论文与演讲、火山引擎官方文档、Intel 联合白皮书

---

## 一、整体技术栈

字节跳动在 SRE/Ops AI Agent 方面形成了三层技术栈：底层硬件故障检测与容错（Minder、ByteRobust、MegaScale）、中间 SRE 智能运维层（SRE-Copilot、M3-Agent-Control、SOPAgent）、上层平台层（火山引擎 AgentKit）。从万卡 GPU 集群的物理故障检测到业务层的故障诊断根因分析，再到面向企业的 Agent 全生命周期管理，覆盖比较完整。

---

## 二、底层：大规模集群故障检测与容错

### 2.1 Minder（NSDI 2025）

面向大规模分布式训练场景（单任务最多 1500+ 台机器、10000+ NVIDIA Ampere GPU），生产环境部署超过一年。 **核心思路：** 利用分布式训练中 3D 并行带来的机器间负载相似性，以及故障的持续性特征做异常检测。 **检测算法四步流程：**

1.  为每个监控指标训练独立的 LSTM-VAE 模型（hidden_size=4, latent_size=8, lstm\_layer=1），对原始数据去噪后提取时序特征到隐空间
    
2.  计算机器间成对欧几里得距离，归一化后找出最异常的机器
    
3.  连续性验证：异常模式需持续 4 分钟以上才触发告警，过滤瞬态抖动
    
4.  优先级指标序列：决策树分类器对指标按故障敏感度排序，优先检查 CPU 使用率、GPU 指标、NVLink 带宽、PFC 包速率
    

**监控指标：** 40+ 指标，秒级粒度，覆盖计算（CPU、GPU duty cycle、显存带宽、tensor core 活跃度）、通信（NVLink 带宽、PFC TX/RX）、存储（内存/磁盘使用率）三个维度。 **效果数据：** 平均检测延迟 3.6 秒（比人工快 500 倍），Precision 0.904，Recall 0.883，F1 0.893。ECC 错误（38.9% 的故障）和 CUDA 执行错误（14.6%）召回率高；性能退化和 AOC 错误召回率较低。 **自动恢复：** 检测到故障机器后，从 K8s 集群中驱逐该机器，自动替换，从最近 checkpoint 恢复训练。 来源：https://arxiv.org/abs/2411.01791 / https://www.usenix.org/conference/nsdi25/presentation/deng

### 2.2 ByteRobust

面向 9600 GPU 规模的 LLM 训练容错基础设施。 **架构：** 每个训练 Pod 运行 Robust Agent 守护进程，Monitor 组件收集多维度数据检测异常。心跳机制周期性向 Driver 发送心跳，封装各类信息实现实时异常检测与预警。超时未收到状态报告时触发恢复程序：暂停所有训练任务，执行自检诊断。 **故障类型覆盖：** CUDA 错误、NaN 值、任务挂起等。 **静默数据损坏（SDC）检测：** NVIDIA 的 EUD 诊断工具仅 70% 召回率。字节自研 MiniGPT 验证套件，使用确定性工作负载做机内验证，双阶段重放测试做机间故障复现，补上了 EUD 的召回率缺口。 **效果数据：** 三个月训练任务在 9600 GPU 上达到 97% ETTR。 来源：https://arxiv.org/abs/2509.16293

### 2.3 MegaScale（NSDI 2024）

万卡集群训练系统的运维能力。多级监控系统，一级为毫秒级监控（判断网络阻塞），二级跟踪各项指标判断整体健康状况。自动检测和修复超过 90% 的软硬件故障。三维并行训练可视化工具定位 GPU 故障节点（有缺陷 GPU 在 NCCL 通信时概率性阻塞导致整机挂起）。175B 模型在 12288 GPU 上达到 55.2% MFU。 来源：https://arxiv.org/html/2402.15627v1

### 2.4 Intel 联合方案

字节跳动与 Intel 联合发布超大规模数据中心故障管理方案白皮书。 **技术方案：** 基于 Intel MRT（Memory Resilience Technology）的内存故障预测与隔离，AI 算法在微观层面检测内存故障并主动预测潜在风险。支持第六代及后续 Xeon 服务器的实时在线诊断，与 Intel ASD（At-Scale Debug）结合提供远程调试。 **运营成果（2024.7 - 2025.6）：** 处理 400+ 系统故障并推荐对应目标微码升级；识别 260+ 软件引起的崩溃，提供固件本地化方案避免不必要的 CPU 硬件更换；51% 的问题内存通过 UE retry 错误日志和物理地址定位；14% 的 PCIe 相关问题定位到外部设备。 来源：https://www.intel.cn/content/dam/www/central-libraries/cn/zh/documents/2025-09/25-cmf49x-bytedance-and-hyperscale-fault-management-solution-white-paper-en.pdf

---

## 三、中间层：SRE 智能运维

### 3.1 SRE-Copilot

大语言模型与 AIOps 结合的框架，在 2023 CCF 国际 AIOps 挑战赛中获得冠军，负责人张翔（中科院计算所博士）在 AiDD 研发数字峰会做过专题分享。

**三层架构：**

1.  **数据源 Agent 层：** 按数据模态拆分。LogAgent 负责日志异常检测与检索；TraceAgent 分析调用链数据做初步诊断；TradeAgent 监控交易量等黄金指标异常；MonitorAgent 分析主机指标（CPU、负载、网络）；CMDBAgent 查询拓扑关系与 CMDB 信息
    
2.  **功能 Agent 层：** 基于 ReAct 框架（Reasoning + Acting 交替执行），每步输出推理过程降低幻觉风险。处理知识库问答、工作流编排、故障报告生成、代码生成
    
3.  **Copilot 编排器：** 面向用户，负责意图识别、参数提取、任务分派
    

**核心技术组件：** **混合专家（MoE）系统：** 多个专业子 Agent 通过集成学习方式组合，类似 GPT 的专家整合策略。 **RAG（检索增强生成）：** 将专家经验和历史故障记录向量化存入向量数据库。故障摘要作为 query，检索 Top-N 相关文档后与 Prompt 组合送入 LLM 推理。自反思机制（reflection）可将准确率提升 30% 以上。 **Tool Calling：** LLM 通过 function calling 调用外部工具（数据库查询、指标定义、变更事件查询等），解决私域知识和时效性问题。

**异常检测设计：** 异常检测模块不输出 True/False，而是返回自然语言描述（如"CPU 飙升，网络流量激增"），便于 LLM 理解和后续推理。RCAAgent 聚合各 Agent 发现结果，决定下一步分析方向，循环直到无新信息后输出根因结论。 **根因分类：** 将故障数据转换为自然语言描述，在向量空间中与专家经验库匹配，实现对已知故障的高准确率识别和对未知故障的推理能力。 **实现细节：** 竞赛环境使用 ChatGLM 6B（开源模型），在 V100 GPU + 8 核 CPU + 16GB RAM 上运行，证明了小模型 + RAG + 反思机制的可行性。 **自动化输出：** 自动生成诊断报告，覆盖 5W（When-Where-Who-What-Why）；大规模告警场景下自动从告警消息中提取参数触发诊断流程。 **效果数据：** 自愈率 85%，人工干预时间减少 70%，自然语言生成 Ansible 脚本错误率较人工下降 70%。 **规划方向：** 更强基础模型、专用时序/日志模型作为可调用工具、更灵活的多轮 Agent 框架（支持故障排查中的实时人工介入）、从 SOP 文档直接生成工作流。 来源：https://blog.csdn.net/ByteDanceTech/article/details/135420707 / https://blog.csdn.net/weixin\_52705010/article/details/136345603 / https://www.53ai.com/news/qianyanjishu/2024052521580.html / https://juejin.cn/post/7320037969981227049

### 3.2 M3-Agent-Control：多智能体协作框架

源自 Coze 平台核心技术的开源多智能体协作框架，已支撑 1200+ 业务场景的智能体部署。 **技术架构：** 分层通信协议栈，分为战略层（目标对齐）、战术层（任务同步）、执行层（操作协调），整体通信延迟控制在 8ms 以内。 **运维场景部署：** 三类智能体（网络分析、日志解析、性能监控）协同工作。 **效果数据：** 故障响应时间从平均 47 分钟缩短至 9 分钟；系统可用性提升至 99.99%；复杂故障定位准确率 92%（较传统监控工具提高 40 个百分点）。 来源：https://github.com/ByteDance-Seed/m3-agent / https://adg.csdn.net/697093cc437a6b40336ac951.html

### 3.3 SOPAgent：私域知识驱动的智能运维

抖音算法工程师王宁在 QCon 北京分享的"从私域知识到智能 Agent：构建智能运维知识库"。 **核心思路：** 将企业私域知识（文档、群聊、工单等）与 LLM 深度融合。 **技术栈：** 图片识别（OCR/视觉理解）处理文档中的图表；ReAct 式知识抽取；GraphRAG 知识图谱作为中间层，整合结构化数据（数据仓库、在线数据库、故障数据库、工单数据库、告警数据库）和非结构化数据（离线文档、知识文档、群聊实时数据）。 **应用场景：** 新人培训、知识持续迭代、自动化运维、智能体构建。 来源：https://www.infoq.cn/article/aw2smrhbnbf2hx19aro9

### 3.4 视觉 Agent 与多模态能力

视觉 Agent 解析设备面板图，自动识别硬件故障（指示灯状态、物理损坏等），生成修复方案。声音分析模块分析设备运行时的异常声音音频数据辅助故障判断。多模态 Agent 分别负责网络层、服务器硬件、应用日志等维度，通过信息共享综合分析定位根因。 关于视觉 Agent 的模型架构、训练数据、部署方式等技术细节，公开资料较少，可能仍处于内部实践阶段。 来源：https://blog.csdn.net/beautifulmemory/article/details/144632647

---

## 四、上层：火山引擎 AgentKit 与 Agent Ops

### 4.1 范式转变

火山引擎总裁谭待提出的核心论点：AI 时代的基础设施核心将从 Web/App 转向智能 Agent，云架构需要为此重构。OPS 从纯运维（维护系统运行）扩展到运营（管理 Agent 的行为、身份、合规、生命周期），安全从边界防御转向全生命周期嵌入。

### 4.2 AgentKit 八大模块

| 模块 | 能力 |
| --- | --- |
| Identity | Agent 身份管理，最小权限 + 细粒度授权，OAuth 2.0 的 2LO 与 3LO 授权模型，全链路调用行为追溯 |
| Runtime | 全托管执行环境，自动扩缩容，无需单独配置计算/网络/存储依赖 |
| Sandbox | 分钟内调度万级别实例的安全代码沙箱，所有可能修改系统环境、访问敏感数据或执行不可信代码的调用都在沙箱中运行 |
| Gateway | MCP 协议服务与工具集成层 |
| Memory | 内置 RAG，持久化知识存储与检索策略 |
| Monitoring | 端到端 Agent 观测，追踪耗时和 Token 消耗，透明注入不影响业务性能 |
| Evaluation | 测试集、评估器、实验验证 |
| Safety Guardrails | 输入过滤、输出合规校验、敏感操作审批工作流、行为审计 |

### 4.3 基础设施层面的变化

数据库需支持 Agent 状态持久化；计算资源按任务流动态调度；网络需保障多 Agent 协同的低延迟通信；GPU 云基础设施以 GPU 为中心重构，支持 320Gbps vRDMA 高速互联。 来源：https://www.volcengine.com/solutions/ai-cloud-native-agentkit / https://www.volcengine.com/docs/86681/1844823 / https://www.sohu.com/a/967950389\_211762 / https://zhuanlan.zhihu.com/p/1986764984575886310

---

## 五、对我们团队的参考价值

**SRE-Copilot 的数据源 Agent 拆分思路**跟我们面对的可观测性碎片化问题有直接相关性。字节也是按数据模态各建一个 Agent（Log/Trace/Monitor/CMDB），而非假设有统一遥测平台。这个思路比"先统一数据源再做 Agent"更务实，对我们当前三块业务各有不同监控栈的现状是可行的路径。 **RAG + 反思机制**在故障诊断中的效果数据（准确率提升 30%+）对我们的监控报警治理 Agent（Q2 方向 9.4）有参考价值。我们的历史告警处理记录可以用同样的方式向量化，让 Agent 基于历史经验做上下文补全。 **M3-Agent-Control 的分层通信协议**对后续多专项 Agent（容量巡检、SLO 巡检、报警治理）的协同有架构参考价值。 **AgentKit 的 Monitoring 模块**提醒我们：Agent 级别的可观测性（耗时、Token 消耗、调用链追踪）是容易被忽略但后续必要的基础设施需求，在 Agent 建设初期就应该考虑评测和观测能力。

---

_本文档基于 2026 年 3 月 25 日的公开信息整理。视觉 Agent 等部分能力的技术细节尚未充分公开，后续关注 QCon/AiDD 等技术大会更新。_