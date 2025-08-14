#!/usr/bin/env node

/**
 * 增强版AI描述生成器
 * 功能：
 * 1. 提取绘本书名
 * 2. 通过AI搜索工具查询绘本的核心内容、主题和风格
 * 3. 分析插图的具体画面内容
 * 4. 结合绘本主旨和画面内容生成智能描述
 * 5. 确保描述既贴合视觉画面又符合绘本主题
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  BATCH_SIZE: 3, // 批处理大小（由于需要多次AI调用）
  AI_DELAY: 3000, // AI API调用间隔（毫秒）
  SEARCH_DELAY: 1000, // 搜索API间隔
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 3000 // 重试延迟
};

// 全局变量
let supabase, pinecone, pineconeIndex, openai;
let processStats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: new Date(),
  failedRecords: []
};

// 初始化客户端
async function initializeClients() {
  console.log('🚀 初始化增强版AI描述生成系统...\n');
  
  try {
    // 检查必要的环境变量
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'VITE_PINECONE_API_KEY',
      'VITE_PINECONE_INDEX_NAME',
      'VITE_OPENAI_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`❌ 缺少以下环境变量: ${missingVars.join(', ')}`);
    }

    // 初始化 Supabase
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase 客户端初始化成功');

    // 初始化 Pinecone
    pinecone = new Pinecone({
      apiKey: process.env.VITE_PINECONE_API_KEY
    });
    pineconeIndex = pinecone.index(process.env.VITE_PINECONE_INDEX_NAME);
    console.log('✅ Pinecone 客户端初始化成功');

    // 初始化 OpenAI
    openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY,
      baseURL: process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    });
    console.log('✅ OpenAI 客户端初始化成功\n');

  } catch (error) {
    console.error('❌ 客户端初始化失败:', error.message);
    process.exit(1);
  }
}

// 重试机制
async function retryOperation(operation, maxRetries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`  ⚠️ 第${attempt}次尝试失败: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`  ⏳ ${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // 指数退避
      }
    }
  }
  
  throw lastError;
}

// 步骤1: 搜索绘本信息
async function searchBookInfo(bookTitle) {
  try {
    console.log(`   🔍 搜索绘本《${bookTitle}》的核心信息...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `请详细介绍绘本《${bookTitle}》的以下信息：

1. **故事主题和核心内容**：这本绘本讲述了什么故事？主要情节是什么？

2. **教育意义和价值观**：这本绘本想要传达给儿童什么教育意义？培养什么品质？

3. **艺术风格和视觉特色**：这本绘本的插画风格是什么？色彩特点如何？

4. **目标年龄和适用场景**：适合什么年龄段的儿童？在什么场景下阅读？

5. **情感基调和氛围**：整本书的情感氛围是怎样的？温馨、欢快、感人还是其他？

请用中文回答，每个方面都要详细说明。如果你不确定某本绘本的具体信息，请基于书名进行合理推测，并说明这是推测。`
        }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const bookInfo = response.choices[0]?.message?.content || '未找到相关绘本信息';
    console.log(`   ✅ 绘本信息搜索完成: ${bookInfo.substring(0, 100)}...`);
    
    return bookInfo;
  } catch (error) {
    throw new Error(`绘本信息搜索失败: ${error.message}`);
  }
}

// 步骤2: 分析插图画面内容
async function analyzeImageContent(imageUrl) {
  try {
    console.log(`   👁️ 分析插图画面内容...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请仔细观察这张插图，详细描述以下内容：

1. **画面主要元素**：画面中有哪些人物、动物、物体？它们的位置关系如何？

2. **场景和背景**：故事发生在什么地方？是室内还是户外？具体环境如何？

3. **人物表情和动作**：主要角色的表情如何？在做什么动作？传达什么情绪？

4. **色彩和光线**：画面的主要色调是什么？光线效果如何？

5. **构图和视角**：画面采用什么构图方式？从什么角度展现场景？

6. **细节和特色**：有什么特别的细节或有趣的元素？

请用中文详细描述，注重客观准确。`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 600,
      temperature: 0.3 // 降低温度以获得更客观的描述
    });

    const imageAnalysis = response.choices[0]?.message?.content || '无法分析图片内容';
    console.log(`   ✅ 画面分析完成: ${imageAnalysis.substring(0, 100)}...`);
    
    return imageAnalysis;
  } catch (error) {
    throw new Error(`图片分析失败: ${error.message}`);
  }
}

// 步骤3: 生成综合AI描述
async function generateEnhancedDescription(bookTitle, bookInfo, imageAnalysis, imageUrl) {
  try {
    console.log(`   🎨 结合绘本主旨和画面内容生成智能描述...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `基于以下信息，请为这张来自绘本《${bookTitle}》的插图生成一个既准确描述画面内容又体现绘本主旨的智能描述：

【绘本背景信息】
${bookInfo}

【插图画面分析】
${imageAnalysis}

请生成一个400-600字的综合描述，要求：

1. **画面描述准确性**：准确描述图片中的具体内容，不能编造不存在的元素

2. **主题契合度**：描述要体现绘本的核心主题和教育价值

3. **情感氛围一致**：描述的情感基调要与绘本整体氛围相符

4. **教育价值体现**：分析这幅插图在绘本中的教育意义

5. **艺术风格分析**：结合绘本的艺术特色分析画面的视觉效果

6. **儿童视角考虑**：从儿童的角度理解和解读画面内容

请用优美流畅的中文写作，分为3-4个自然段，每段都有明确的主题重点。`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const enhancedDescription = response.choices[0]?.message?.content || `来自《${bookTitle}》的精美插图`;
    console.log(`   ✅ 智能描述生成完成: ${enhancedDescription.substring(0, 100)}...`);
    
    return enhancedDescription;
  } catch (error) {
    throw new Error(`智能描述生成失败: ${error.message}`);
  }
}

// 生成向量嵌入
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536
    });
    
    return response.data[0].embedding;
  } catch (error) {
    throw new Error(`向量嵌入生成失败: ${error.message}`);
  }
}

// 获取需要增强描述的记录
async function getRecordsToEnhance() {
  console.log('🔍 正在扫描需要增强AI描述的记录...\n');
  
  // 可以选择特定条件的记录，比如最近上传的或者指定的记录
  const { data: records, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20); // 限制处理数量，避免过多API调用
  
  if (error) {
    throw new Error(`获取记录失败: ${error.message}`);
  }
  
  return records || [];
}

// 更新单个记录的增强描述
async function updateRecordEnhancedDescription(record, index, total) {
  console.log(`\n🎯 [${index + 1}/${total}] 增强记录: ${record.filename}`);
  console.log(`   📖 书名: ${record.book_title}`);
  
  try {
    // 步骤1: 搜索绘本信息
    const bookInfo = await retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, CONFIG.SEARCH_DELAY));
      return await searchBookInfo(record.book_title);
    });
    
    // 步骤2: 分析插图内容
    const imageAnalysis = await retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, CONFIG.AI_DELAY));
      return await analyzeImageContent(record.image_url);
    });
    
    // 步骤3: 生成综合描述
    const enhancedDescription = await retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, CONFIG.AI_DELAY));
      return await generateEnhancedDescription(
        record.book_title, 
        bookInfo, 
        imageAnalysis, 
        record.image_url
      );
    });
    
    // 步骤4: 生成新的向量嵌入
    console.log('   🧮 生成向量嵌入...');
    const newEmbedding = await retryOperation(async () => {
      return await generateEmbedding(enhancedDescription);
    });
    
    console.log(`   ✅ 向量嵌入生成成功: ${newEmbedding.length}维`);
    
    // 步骤5: 更新数据库
    console.log('   💾 更新数据库...');
    const { error: dbError } = await supabase
      .from('illustrations_optimized')
      .update({
        original_description: enhancedDescription,
        original_embedding: newEmbedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);
    
    if (dbError) {
      throw new Error(`数据库更新失败: ${dbError.message}`);
    }
    console.log('   ✅ 数据库更新成功');
    
    // 步骤6: 更新Pinecone向量
    console.log('   🔍 更新Pinecone向量...');
    await retryOperation(async () => {
      await pineconeIndex.upsert([{
        id: record.id,
        values: newEmbedding,
        metadata: {
          filename: record.filename,
          book_title: record.book_title,
          original_description: enhancedDescription,
          image_url: record.image_url
        }
      }]);
    });
    
    console.log('   ✅ Pinecone更新成功');
    
    // 保存详细信息用于报告
    processStats.success++;
    
    return {
      success: true,
      bookInfo,
      imageAnalysis,
      enhancedDescription
    };
    
  } catch (error) {
    console.log(`   ❌ 增强失败: ${error.message}`);
    processStats.failed++;
    processStats.failedRecords.push({
      filename: record.filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return { success: false, error: error.message };
  } finally {
    processStats.processed++;
  }
}

// 显示进度报告
function generateProgressReport() {
  const elapsed = (new Date() - processStats.startTime) / 1000;
  const remainingFiles = processStats.total - processStats.processed;
  const avgTimePerFile = processStats.processed > 0 ? elapsed / processStats.processed : 0;
  const estimatedRemaining = remainingFiles * avgTimePerFile;
  
  console.log('\n📊 ===== 进度报告 =====');
  console.log(`   📈 总进度: ${processStats.processed}/${processStats.total} (${((processStats.processed/processStats.total)*100).toFixed(1)}%)`);
  console.log(`   ✅ 成功: ${processStats.success}`);
  console.log(`   ❌ 失败: ${processStats.failed}`);
  console.log(`   ⏱️ 已用时间: ${Math.floor(elapsed/60)}分${Math.floor(elapsed%60)}秒`);
  console.log(`   🔮 预计剩余: ${Math.floor(estimatedRemaining/60)}分${Math.floor(estimatedRemaining%60)}秒`);
  console.log(`   📊 平均速度: ${avgTimePerFile.toFixed(1)}秒/图片`);
  console.log('========================\n');
}

// 确认操作
function confirmOperation(recordsToEnhance) {
  return new Promise((resolve) => {
    console.log(`\n❓ 确认要为这 ${recordsToEnhance.length} 条记录生成增强AI描述吗？`);
    console.log('   这将执行以下步骤：');
    console.log('   1. 🔍 搜索每本绘本的核心信息和风格');
    console.log('   2. 👁️ 深度分析插图的画面内容');
    console.log('   3. 🎨 结合绘本主旨生成智能描述');
    console.log('   4. 🧮 更新向量嵌入和搜索索引');
    console.log(`   预计耗时: ${Math.ceil(recordsToEnhance.length * 15 / 60)} 分钟（每张图约15秒）`);
    console.log('\n   输入 "ENHANCE" 确认开始增强');
    console.log('   按 Ctrl+C 取消操作\n');
    
    process.stdout.write('请输入: ');
    
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toUpperCase();
      
      if (input === 'ENHANCE') {
        resolve(true);
      } else {
        console.log('❌ 操作已取消');
        resolve(false);
      }
    });
  });
}

// 主函数
async function main() {
  console.log('🎨 ===== 增强版AI描述生成系统 =====\n');
  console.log('本系统将为每张插图执行以下智能分析流程：');
  console.log('🔍 绘本信息搜索 → 👁️ 画面内容分析 → 🎨 智能描述生成\n');
  
  try {
    // 初始化客户端
    await initializeClients();
    
    // 获取需要增强的记录
    const recordsToEnhance = await getRecordsToEnhance();
    processStats.total = recordsToEnhance.length;
    
    console.log(`📊 找到 ${recordsToEnhance.length} 条记录可以进行AI描述增强\n`);
    
    if (recordsToEnhance.length === 0) {
      console.log('🎉 没有找到需要增强的记录！');
      return;
    }
    
    // 显示部分记录预览
    console.log('📋 记录预览:');
    recordsToEnhance.slice(0, 5).forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.filename} - 《${record.book_title}》`);
    });
    if (recordsToEnhance.length > 5) {
      console.log(`   ... 还有 ${recordsToEnhance.length - 5} 条记录`);
    }
    
    // 确认操作
    const shouldProceed = await confirmOperation(recordsToEnhance);
    
    if (!shouldProceed) {
      return;
    }
    
    // 执行增强处理
    console.log('\n🚀 开始增强AI描述生成...\n');
    
    // 分批处理
    for (let i = 0; i < recordsToEnhance.length; i += CONFIG.BATCH_SIZE) {
      const batch = recordsToEnhance.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(`\n🔄 处理批次 ${Math.floor(i/CONFIG.BATCH_SIZE) + 1}/${Math.ceil(recordsToEnhance.length/CONFIG.BATCH_SIZE)}`);
      
      // 串行处理批次内的文件（避免API限流）
      for (let j = 0; j < batch.length; j++) {
        await updateRecordEnhancedDescription(batch[j], i + j, recordsToEnhance.length);
      }
      
      // 每批次后显示进度报告
      generateProgressReport();
      
      // 批次间休息
      if (i + CONFIG.BATCH_SIZE < recordsToEnhance.length) {
        console.log('⏳ 批次间休息 5 秒...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // 显示最终结果
    console.log('\n📊 ===== 增强处理完成 =====');
    console.log(`✅ 成功增强: ${processStats.success} 条记录`);
    console.log(`❌ 处理失败: ${processStats.failed} 条记录`);
    console.log(`📈 成功率: ${((processStats.success / processStats.total) * 100).toFixed(1)}%`);
    
    if (processStats.failed > 0) {
      console.log('\n⚠️ 失败记录:');
      processStats.failedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.filename}: ${record.error}`);
      });
    }
    
    if (processStats.success > 0) {
      console.log('\n🎉 增强完成！现在的AI描述将：');
      console.log('   ✨ 准确反映插图的具体画面内容');
      console.log('   📚 深度结合绘本的核心主题和教育价值');
      console.log('   🎨 体现绘本的艺术风格和情感基调');
      console.log('   👶 考虑儿童的阅读视角和理解能力');
      console.log('\n💡 建议：');
      console.log('   1. 在前端系统中查看增强后的AI描述');
      console.log('   2. 测试搜索功能的准确性提升');
      console.log('   3. 验证描述与绘本主题的契合度');
    }
    
  } catch (error) {
    console.error('❌ 增强处理失败:', error.message);
    process.exit(1);
  }
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n⚠️ 接收到中断信号，正在退出...');
  if (processStats.processed > 0) {
    generateProgressReport();
  }
  process.exit(0);
});

if (require.main === module) {
  main();
}

module.exports = { 
  searchBookInfo, 
  analyzeImageContent, 
  generateEnhancedDescription,
  updateRecordEnhancedDescription 
}; 