# 项目结构说明

## 📁 目录结构

```
image-processor/
├── docs/                           # 📚 文档目录
│   ├── PROJECT_STRUCTURE.md        # 项目结构说明
│   ├── SOLUTION_SUMMARY.md         # 解决方案总结
│   ├── ENHANCED_PROCESSING_GUIDE.md # 增强处理指南
│   └── OPENAI_SETUP_GUIDE.md       # OpenAI设置指南
├── src/                            # 🔧 源代码目录
│   ├── api/                        # API接口
│   │   ├── imageProcessor.ts       # 图像处理API
│   │   ├── openaiProxy.ts          # OpenAI代理
│   │   └── supabaseClient.ts       # Supabase客户端
│   ├── components/                 # React组件
│   │   ├── DatabaseViewer.tsx      # 数据库查看器
│   │   ├── ImageUploader.tsx       # 图像上传器
│   │   ├── ProcessingStatus.tsx    # 处理状态
│   │   └── Statistics.tsx          # 统计组件
│   ├── config/                     # 配置文件
│   ├── processors/                 # 🔄 处理器目录
│   │   ├── process-all-images-enhanced.ts # 增强版图像处理器
│   │   ├── process.ts              # 基础处理器
│   │   └── merge-csv-data.ts       # CSV数据合并器
│   ├── services/                   # 🛠️ 服务目录
│   │   ├── enhanced-ai-service.ts  # 增强AI服务
│   │   └── cloud-ai-service.ts     # 云AI服务
│   ├── App.tsx                     # 主应用组件
│   ├── main.tsx                    # 应用入口点
│   ├── types.ts                    # TypeScript类型定义
│   └── index.css                   # 全局样式
├── scripts/                        # 🔨 脚本目录
│   ├── test/                       # 测试脚本
│   │   ├── test-*.cjs              # 各种测试脚本
│   │   └── debug-*.cjs             # 调试脚本
│   ├── utils/                      # 工具脚本
│   │   ├── check-*.cjs             # 检查脚本
│   │   ├── verify-*.js             # 验证脚本
│   │   ├── network-*.js            # 网络相关脚本
│   │   └── cleanup-*.cjs           # 清理脚本
│   ├── batch-update-annotations.cjs # 批量更新标注
│   ├── batch-upload-images.cjs     # 批量上传图像
│   ├── migrate-to-optimized-table.cjs # 迁移到优化表
│   ├── process-single-image.cjs    # 单图像处理
│   ├── sync-supabase-to-pinecone.cjs # 同步数据
│   ├── update-ai-descriptions-only.cjs # 更新AI描述
│   └── update-database-urls.cjs    # 更新数据库URL
├── data/                           # 📊 数据目录
│   ├── images/                     # 图像文件
│   ├── all_images_metadata_enhanced.csv # 增强元数据
│   ├── all_images_metadata.csv     # 基础元数据
│   ├── image_urls.csv              # 图像URL列表
│   └── metadata.csv                # 主元数据文件
├── sql/                            # 🗄️ SQL脚本
│   └── create_illustrations_optimized_table_simple.sql
├── models/                         # 🤖 AI模型
│   ├── clip-vit-base-patch32/      # CLIP模型
│   └── vit-gpt2-image-captioning/  # 图像标题生成模型
├── .env.local.example              # 环境变量示例
├── package.json                    # 项目配置
└── README.md                       # 项目说明
```

## 🎯 主要功能模块

### 1. 图像处理 (`src/processors/`)
- **process-all-images-enhanced.ts**: 增强版批量图像处理器
- **process.ts**: 基础图像处理逻辑
- **merge-csv-data.ts**: CSV数据合并工具

### 2. AI服务 (`src/services/`)
- **enhanced-ai-service.ts**: 增强AI描述生成服务
- **cloud-ai-service.ts**: 云端AI服务接口

### 3. 前端组件 (`src/components/`)
- **ImageUploader.tsx**: 图像上传界面
- **DatabaseViewer.tsx**: 数据库内容查看器
- **Statistics.tsx**: 处理统计显示
- **ProcessingStatus.tsx**: 实时处理状态

### 4. API接口 (`src/api/`)
- **imageProcessor.ts**: 核心图像处理API
- **openaiProxy.ts**: OpenAI API代理
- **supabaseClient.ts**: 数据库客户端

## 🔧 脚本说明

### 开发脚本
- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run process-enhanced` - 运行增强图像处理

### 数据处理脚本
- `npm run merge-csv` - 合并CSV数据
- `npm run upload-images` - 批量上传图像
- `npm run update-ai-descriptions` - 更新AI描述

### 测试和验证脚本
- `npm run verify` - 系统完整性验证
- `npm run test-openai` - 测试OpenAI API连接
- `npm run network-check` - 网络连接检查 