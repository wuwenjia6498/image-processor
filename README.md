# 图像处理系统

一个基于AI的图像处理和标注系统，支持图像上传、自动描述生成和数据管理。

## 主要功能

- 🖼️ 图像上传和处理
- 🤖 AI自动生成图像描述 (使用OpenAI API)
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
- `npm run merge-csv` - 合并CSV数据文件
- `npm run verify` - 系统验证

## AI模型

项目使用OpenAI的GPT-4 Vision模型进行图像描述生成，无需本地AI模型文件，简化了部署和维护。

## 文档

详细文档请查看 `docs/` 目录。

## 许可证

ISC 