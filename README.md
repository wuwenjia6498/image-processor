# Image Processor｜绘本插图智能处理与搜索系统

本项目面向绘本插图数据的全流程处理：批量上传图片 → AI 生成中文描述 → 统一向量化 → 存入数据库与向量库 → 前端支持传统与多维度加权语义搜索（含自动降级与超时容错）。

- **后端与脚本**：Node.js/TypeScript 脚本
- **数据库**：Supabase（Postgres + Storage + RPC 函数）
- **向量库**：Pinecone（1536 维，统一 OpenAI Embeddings 模型）
- **AI**：OpenAI（原生或第三方兼容端点），可选 Serper 搜索辅助
- **前端**：Vite + React（端口默认 3004），提供搜索与可视化

---

## ✨ 核心能力

- **🖼️ 批量图片上传**：整目录处理 1000+ 张图片，断点续传与进度监控
- **🤖 AI 中文描述**：基于 GPT（如 GPT-4o-mini/GPT-4V）生成高质量视觉描述
- **🧮 统一向量化**：`text-embedding-3-small`，1536 维统一向量维度
- **🔎 多维度加权搜索**：7 主题维度加权，预设模板 + 自定义权重
- **⚡ 自动降级与超时**：优化版 → 简化版 → 原始版，稳态可用
- **📊 报告与日志**：批处理报告写入 `reports/`，详细日志便于排障

---

## 🗂️ 项目结构
```
├─ src/
│  ├─ api/
│  │  ├─ weighted-search-api.ts          # 加权搜索（含降级与超时）
│  │  └─ vectorization-proxy.ts          # 文本向量化封装
│  ├─ services/
│  │  ├─ unified-embedding.ts            # 统一 Embeddings 服务（1536 维）
│  │  ├─ enhanced-ai-service.ts          # 生成更丰富描述（Node）
│  │  └─ cloud-ai-service.ts             # GPT-4V 图像描述（Node）
│  ├─ processors/                        # TS 处理脚本入口
│  └─ lib/supabase.ts                    # 前端/Node 通用 Supabase 客户端
├─ scripts/
│  ├─ batch-upload-enhanced.cjs          # 批量上传（AI + 向量 + DB + Pinecone）
│  ├─ resume-batch-upload.cjs            # 断点续传
│  ├─ monitor-batch-progress.cjs         # 上传进度监控
│  └─ quick-start.cjs                    # 交互式快速向导
├─ data/
│  └─ images/                            # 放置待上传的图片
├─ reports/                              # 批处理报告输出目录
├─ docs/                                 # 核心指南文档
├─ sql/                                  # Supabase SQL 脚本（索引/函数/优化）
├─ .env.local.example                    # 环境变量样例
└─ vite.config.ts                        # 前端开发与构建配置（端口 3004）
```

---

## 🧰 环境要求

- Node.js 18+（建议 20+）
- 已创建的 Supabase 项目与 Storage bucket（`illustrations`）
- Pinecone 账户与索引（维度 1536）
- OpenAI API Key（原生或兼容平台，支持自定义 Base URL）
- Windows 用户：建议使用 PowerShell，路径包含空格时请用引号包裹

---

## 🛠️ 安装与初始化

### 1) 安装依赖

```bash
# Node 依赖
npm install
```

### 2) 配置环境变量

复制 `.env.local.example` 为 `.env.local` 并填写：

```bash
# Supabase（必须）
SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"

# Pinecone（必须）
PINECONE_API_KEY="YOUR_PINECONE_API_KEY"
PINECONE_INDEX_NAME="YOUR_PINECONE_INDEX_NAME"

# OpenAI（必须：后端/脚本）
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
# 可选：第三方兼容端点
# OPENAI_BASE_URL="https://your-compatible-endpoint/v1"

# Serper（可选：网络搜索增强）
SERPER_API_KEY="YOUR_SERPER_API_KEY"
```

前端要在浏览器里使用 OpenAI，需要以 `VITE_` 前缀暴露：

```bash
VITE_OPENAI_API_KEY=sk-your-frontend-key
# 可选自定义端点
# VITE_OPENAI_BASE_URL=https://api.openai.com/v1
```

> 安全提示：前端暴露的密钥仅用于开发调试，请谨慎使用并限制权限。

### 3) 初始化数据库（Supabase）

推荐遵循 `docs/SUPABASE_EXECUTION_GUIDE.md` 顺序执行：

1. `sql/step1_create_indexes.sql`（创建 7 个向量索引，必须）
2. `sql/step2_create_optimized_function.sql`（优化版函数，必须）
3. `sql/step3_create_simple_function.sql`（简化版函数，推荐）
4. `sql/step4_create_monitoring.sql`（监控视图，可选）

或一键参考：`sql/optimize_weighted_search_performance.sql`（包含索引/函数/监控）。

执行后验证：应存在 7 个索引、3 个 `weighted_semantic_search*` 函数。

---

## 🚀 快速开始

### 方式 A：交互式向导

```bash
npm run quick-start
```
- 检查环境变量与依赖
- 测试 Supabase 连接
- 生成示例目录结构与使用指南

### 方式 B：直接启动前端

```bash
npm run dev
```
- 本地开发地址：`http://localhost:3004`

---

## 🖼️ 批量上传与处理

详见 `docs/BATCH_UPLOAD_GUIDE.md`，常用命令：

```bash
# 1) 批量上传（AI 描述 + 向量 + DB + Pinecone）
npm run batch-upload-enhanced "G:/path/to/your/images"

# 2) 监控实时进度（另开终端）
npm run monitor-upload

# 3) 断点续传
npm run resume-upload "G:/path/to/your/images" --auto-confirm
```

处理流程：文件扫描 → 重复检测 → Storage 上传 → GPT 生成描述 → Embedding 1536 维 → 写入 Supabase → 写入 Pinecone。报告输出到 `reports/`，支持失败重试与统计汇总。

支持格式：`.jpg/.jpeg/.png/.gif/.bmp/.webp`，建议单文件 ≤ 10MB。

---

## 🔄 完整两阶段处理流程

本项目采用两阶段架构，确保处理效率和稳定性：

### 第一阶段：图片上传 + 长描述生成
使用 Node.js/TypeScript 脚本处理图片上传和基础描述生成：

```bash
# 第一阶段：图片上传 + 长描述生成
npm run batch-upload-enhanced "path/to/images"
npm run monitor-upload
npm run resume-upload "path/to/images" --auto-confirm
```

**功能**：
- 批量上传图片到 Supabase Storage
- 使用 GPT-4V 生成图片的长描述文本
- 基础数据写入数据库

### 第二阶段：描述拆解 + 向量化处理
使用 Python 脚本进行深度分析和向量化：

```bash
# 第二阶段：描述拆解 + 向量化处理
python process_illustrations_data_stable.py
```

**功能**：
- 将长描述拆解为 7 个主题维度字段
- 为每个维度生成专门的向量嵌入
- 批量更新到 Supabase 和 Pinecone

**7 个主题维度**：
1. `theme_philosophy` - 主题哲学：核心哲理与人生主题
2. `action_process` - 行动过程：行动过程与成长
3. `interpersonal_roles` - 人际角色：人际角色与情感连接
4. `edu_value` - 教育价值：阅读教育价值
5. `learning_strategy` - 学习策略：阅读学习策略
6. `creative_play` - 创意游戏：创意玩法与想象力
7. `scene_visuals` - 场景视觉：场景氛围与视觉元素

> **💡 提示**：两阶段设计的优势在于分工明确 - Node.js 擅长文件处理和 API 调用，Python 擅长文本分析和机器学习处理。

---

## 🔎 搜索能力（传统 + 加权）

- 传统搜索：基于整体描述向量匹配
- 加权搜索：7 主题维度加权融合，权重预设与自定义（文件 `src/api/weighted-search-api.ts`）
- 统一向量服务：`src/services/unified-embedding.ts`（模型 `text-embedding-3-small`，1536 维校验）

权重预设（节选）：`balanced / educational / creative / procedural / social / visual`

代码关键点：
- `performWeightedSearch(embedding, weights, matchCount, queryText?)`（带 30s 超时 + 质量评估 + 降级）
- `batchWeightedSearch()` 并行多配置合并去重
- `vectorizeText(text)` 将文案转为 1536 维向量

更多用法见 `docs/WEIGHTED_SEARCH_USAGE.md`。

---

## 🔄 自动降级与超时容错

搜索调用按以下顺序自动降级，确保稳定可用：

1. `weighted_semantic_search_optimized`（最佳质量，30s 超时，阈值过滤/CASE/预计算权重）
2. `weighted_semantic_search_simple`（良好质量，15s 超时，仅使用原始描述向量）
3. `weighted_semantic_search`（基础质量，向后兼容的原始实现）

前端与客户端还设置了 HTTP 超时（约 35s）与友好错误信息，详见 `src/lib/supabase.ts`。

---

## 🆘 故障排除

- 400 参数错误（RPC 调用） → 修复函数签名/参数类型
- 500/超时 → 执行 `sql/optimize_weighted_search_performance.sql` 建索引 + 创建优化/简化函数
- **优化版搜索超时** → 执行 `sql/performance_optimization_v2.sql` 使用改进的两阶段查询算法
- 前端无响应或报错 → 重启 `npm run dev`，确认 `VITE_` 前缀变量生效
- 搜索慢/结果为空 → 减少 `match_count`、提高 `similarity_threshold`、使用预设权重、检查是否存在 1536 维向量

### 🔧 优化版搜索性能提升

如果遇到优化版搜索频繁超时，推荐执行性能优化脚本：

```sql
-- 在 Supabase SQL 编辑器中执行
\i sql/performance_optimization_v2.sql
```

### 🌟 精选集优化方案（推荐）

针对大数据量搜索超时问题，我们提供**精选集优化方案**：

```sql
-- 执行精选集创建脚本
\i sql/create_premium_subset.sql
```

**方案特点**：
- **智能筛选**：从3000张图片中筛选300张最高质量的图片
- **多维度评分**：基于描述质量、内容丰富度、教育价值、场景多样性
- **均衡分布**：确保不同书籍的代表性，避免偏向性
- **极速响应**：300张数据的7维度搜索，响应时间 < 3秒
- **质量保证**：精选集包含最具代表性和搜索价值的内容

**筛选标准**：
1. **描述质量** (40%)：长度、详细程度、描述性词汇丰富度
2. **内容丰富度** (30%)：颜色、情感、动作等维度的完整性
3. **教育价值** (20%)：学习、教育、成长相关内容
4. **场景多样性** (10%)：背景、环境、空间描述的多样性

**使用效果**：
- ✅ 搜索成功率：60% → 95%+
- ⚡ 响应时间：6-7秒 → 2-3秒
- 🎯 结果质量：精选内容，匹配度更高
- 📚 覆盖范围：保持各书籍的代表性

**优化原理**：
- **两阶段查询**：先用权重最高的维度快速预筛选，再对候选结果精确计算
- **降低阈值**：相似度阈值从 0.1 降到 0.05，减少过度过滤
- **内存优化**：增加 work_mem 到 256MB，启用 SSD 优化参数
- **超时调整**：函数超时设为 25秒，避免前端 30秒超时

验证清单：
- Supabase 存在 7 个向量索引与 3 个搜索函数
- 前端控制台出现"优化版/简化版/降级"日志
- `reports/` 生成批量报告
- **执行性能检查**：`SELECT * FROM check_search_performance();`
- **精选集状态**：`SELECT COUNT(*) FROM illustrations_premium;` 应返回 300

---

## 🔐 安全与合规

- 切勿提交 `.env.local` 与密钥到仓库
- 对前端暴露的 `VITE_OPENAI_API_KEY` 进行最小权限控制
- 建议为生产环境单独配置，限制用量并监控

---

## 📄 许可证

- 许可证：ISC（见 `package.json`）

---

## 📚 参考文档

- `docs/BATCH_UPLOAD_GUIDE.md`：批量上传与报告
- `docs/WEIGHTED_SEARCH_USAGE.md`：加权搜索用法
- `docs/SUPABASE_EXECUTION_GUIDE.md`：Supabase SQL 执行指南
