# 绘本插图数据处理脚本

这个Python脚本用于处理Supabase中的绘本插图数据，将原始的AI描述文本分析并填充到7个新的主题字段中，同时生成对应的向量嵌入。

## 🚀 功能特性

- **分批处理**：每次处理20条记录，避免超时
- **可重复运行**：只处理`theme_philosophy`为NULL的记录
- **智能分析**：使用GPT-4o模型深度分析文本内容
- **向量生成**：使用`text-embedding-3-large`模型生成高质量向量
- **详细日志**：完整的处理日志，支持文件和控制台输出
- **错误处理**：完善的异常处理和重试机制

## 📋 处理的字段

脚本会为每条记录生成以下7个主题字段及其对应的向量：

1. `theme_philosophy` - 主题哲学：核心哲理与人生主题
2. `action_process` - 行动过程：行动过程与成长
3. `interpersonal_roles` - 人际角色：人际角色与情感连接
4. `edu_value` - 教育价值：阅读教育价值
5. `learning_strategy` - 学习策略：阅读学习策略
6. `creative_play` - 创意游戏：创意玩法与想象力
7. `scene_visuals` - 场景视觉：场景氛围与视觉元素

## 🛠 安装和配置

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 设置环境变量

在运行脚本前，需要设置以下环境变量：

```bash
# Supabase配置
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_ANON_KEY='your-anon-key-here'

# OpenAI配置  
export OPENAI_API_KEY='your-openai-api-key-here'
```

**Windows用户使用：**
```cmd
set SUPABASE_URL=https://your-project.supabase.co
set SUPABASE_ANON_KEY=your-anon-key-here
set OPENAI_API_KEY=your-openai-api-key-here
```

### 3. 获取配置信息

- **Supabase URL和Key**：在Supabase Dashboard的Settings > API中找到
- **OpenAI API Key**：在OpenAI Platform的API Keys页面创建

## 🎯 运行脚本

```bash
python process_illustrations_data.py
```

## 📊 输出示例

```
2024-01-20 10:30:15 - INFO - 客户端初始化成功
2024-01-20 10:30:16 - INFO - 开始处理绘本插图数据...
2024-01-20 10:30:17 - INFO - 获取到 20 条待处理记录
2024-01-20 10:30:18 - INFO - 正在处理记录ID: abc-123, 文件名: illustration_001.jpg
2024-01-20 10:30:19 - INFO -   → 正在调用GPT-4分析文本...
2024-01-20 10:30:22 - INFO -   → 正在生成向量嵌入...
2024-01-20 10:30:24 - INFO -   → 正在更新数据库...
2024-01-20 10:30:25 - INFO -   ✓ 记录 abc-123 处理完成
```

## 📝 日志文件

脚本会生成`illustration_processing.log`日志文件，记录详细的处理过程，方便问题排查。

## ⚠️ 注意事项

1. **API限制**：脚本包含延迟机制以避免触发OpenAI API限制
2. **网络稳定性**：确保网络连接稳定，处理大量数据时可能需要较长时间
3. **成本控制**：GPT-4o和embedding API会产生费用，建议先小批量测试
4. **数据备份**：建议在运行前备份数据库

## 🔧 自定义配置

可以在`IllustrationProcessor`类中修改以下参数：

- `batch_size`：每批处理的记录数（默认20）
- `temperature`：GPT模型的创造性参数（默认0.3）
- `max_tokens`：GPT响应的最大token数（默认1500）

## 📞 支持

如遇到问题，请检查：
1. 环境变量是否正确设置
2. API密钥是否有效
3. 网络连接是否正常
4. 查看日志文件了解详细错误信息