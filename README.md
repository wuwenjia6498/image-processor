# 图像处理系统

一个基于AI的图像处理和标注系统，支持图像上传、自动描述生成和数据管理。

## 主要功能

- 🖼️ 图像上传和处理
- 🤖 AI自动生成图像描述 (使用OpenAI API)
- 🎯 智能绘本主题匹配和提示词生成
- 📚 结合绘本主旨的GPT-4V API描述生成
- 📊 数据库管理和查看
- 🔍 图像语义搜索
- 📈 处理统计和监控

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Node.js + TypeScript
- **数据库**: Supabase
- **AI服务**: OpenAI API (GPT-4 Vision)
- **向量搜索**: Pinecone

## 快速开始

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量：
```bash
cp .env.local.example .env.local
# 编辑 .env.local 添加OpenAI API密钥
```

3. 启动开发服务器：
```bash
npm run dev
```

4. 构建生产版本：
```bash
npm run build
```

## 主要脚本

- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run process-enhanced` - 运行增强版图像处理
- `npm run test-image-description` - 测试基于GPT-4V API的插图描述生成
- `npm run merge-csv` - 合并CSV数据文件
- `npm run verify` - 系统验证

## AI模型

项目使用OpenAI的GPT-4 Vision模型进行图像描述生成，无需本地AI模型文件，简化了部署和维护。

### 基于GPT-4V API的插图描述生成器

系统内置了智能绘本主题匹配功能，能够：
- 🎯 自动识别绘本类型和主题
- 🎨 结合绘本的艺术风格和情感基调生成精准提示词
- 📚 突出绘本的教育价值和意义
- 🌍 考虑文化背景和地域特色
- 🤖 使用真实GPT-4V API生成插图描述

支持多种绘本类型：家庭生活类、情绪教育类、传统文化类、科学探索类、品格教育类等。

## 文档

详细文档请查看 `docs/` 目录。

## 许可证

ISC 