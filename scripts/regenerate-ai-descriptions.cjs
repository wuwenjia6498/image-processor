#!/usr/bin/env node

/**
 * 重新生成AI描述脚本
 * 功能：
 * 1. 查找需要重新生成AI描述的记录（书名已修复但AI描述可能基于错误书名）
 * 2. 使用正确的书名重新生成AI描述
 * 3. 更新数据库和向量数据库
 * 4. 支持批量处理和进度监控
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  BATCH_SIZE: 5, // 批处理大小（AI API有调用限制）
  AI_DELAY: 2000, // AI API调用间隔（毫秒）
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
  console.log('🚀 初始化客户端连接...\n');
  
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

// 生成AI描述（使用正确的书名）
async function generateAIDescription(imageUrl, bookTitle) {
  try {
    console.log(`   🤖 为《${bookTitle}》生成AI描述...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 使用最新的GPT-4o模型，具有强大的视觉分析能力
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请用中文详细分析这张来自绘本《${bookTitle}》的插图，需要包含以下几个方面的深入分析：

1. **场景与内容描述**：详细描述画面的主要内容、场景设置和背景元素

2. **人物与动作分析**：分析人物或动物的外观特征、表情、动作和相互关系

3. **艺术风格与色彩**：分析绘画的艺术风格、色彩运用、构图技巧和视觉效果

4. **情感氛围**：描述画面传达的情感氛围和情绪感受

5. **教育价值**：分析这幅插图在绘本中的教育意义和对儿童成长的积极影响

请用多个段落进行深入分析，每个方面都要详细阐述，总字数控制在400-600字之间。语言要优美流畅，富有感染力。`
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high" // 使用高精度分析
              }
            }
          ]
        }
      ],
      max_tokens: 800, // 增加token数量以获得更详细的描述
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || `来自《${bookTitle}》的精美插图`;
  } catch (error) {
    throw new Error(`AI描述生成失败: ${error.message}`);
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

// 获取需要重新生成描述的记录
async function getRecordsToRegenerate() {
  console.log('🔍 正在扫描需要重新生成AI描述的记录...\n');
  
  // 获取最近修改的记录（可能是书名刚修复的）
  const { data: records, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, updated_at')
    .order('updated_at', { ascending: false });
  
  if (error) {
    throw new Error(`获取记录失败: ${error.message}`);
  }
  
  // 筛选需要重新生成的记录
  const recordsToRegenerate = [];
  
  records.forEach(record => {
    // 检查AI描述中是否包含可能错误的书名引用
    const description = record.ai_description || '';
    const currentBookTitle = record.book_title;
    
    // 如果描述中包含数字后缀的书名，可能需要重新生成
    const hasNumberSuffix = /《[^》]*\d+[^》]*》/.test(description);
    const descriptionBookTitle = description.match(/《([^》]+)》/);
    
    if (hasNumberSuffix || 
        (descriptionBookTitle && descriptionBookTitle[1] !== currentBookTitle)) {
      recordsToRegenerate.push(record);
    }
  });
  
  return recordsToRegenerate;
}

// 更新单个记录的AI描述
async function updateRecordDescription(record, index, total) {
  console.log(`\n📝 [${index + 1}/${total}] 更新记录: ${record.filename}`);
  console.log(`   📖 书名: ${record.book_title}`);
  
  try {
    // 1. 重新生成AI描述
    const newDescription = await retryOperation(async () => {
      return await generateAIDescription(record.image_url, record.book_title);
    }, 2);
    
    console.log(`   ✅ AI描述重新生成成功: ${newDescription.substring(0, 50)}...`);
    
    // 2. 生成新的向量嵌入
    console.log('   🧮 生成向量嵌入...');
    const newEmbedding = await retryOperation(async () => {
      return await generateEmbedding(newDescription);
    }, 2);
    
    console.log(`   ✅ 向量嵌入生成成功: ${newEmbedding.length}维`);
    
    // 3. 更新数据库
    console.log('   💾 更新数据库...');
    const { error: dbError } = await supabase
      .from('illustrations_optimized')
      .update({
        ai_description: newDescription,
        vector_embedding: newEmbedding,
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);
    
    if (dbError) {
      throw new Error(`数据库更新失败: ${dbError.message}`);
    }
    console.log('   ✅ 数据库更新成功');
    
    // 4. 更新Pinecone向量
    console.log('   🔍 更新Pinecone向量...');
    await retryOperation(async () => {
      await pineconeIndex.upsert([{
        id: record.id,
        values: newEmbedding,
        metadata: {
          filename: record.filename,
          book_title: record.book_title,
          ai_description: newDescription,
          image_url: record.image_url
        }
      }]);
    });
    
    console.log('   ✅ Pinecone更新成功');
    
    processStats.success++;
    return true;
    
  } catch (error) {
    console.log(`   ❌ 更新失败: ${error.message}`);
    processStats.failed++;
    processStats.failedRecords.push({
      filename: record.filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return false;
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
  console.log('========================\n');
}

// 确认操作
function confirmOperation(recordsToRegenerate) {
  return new Promise((resolve) => {
    console.log(`\n❓ 确认要重新生成这 ${recordsToRegenerate.length} 条记录的AI描述吗？`);
    console.log('   这将使用正确的书名重新生成AI描述，提高描述的准确性');
    console.log(`   预计耗时: ${Math.ceil(recordsToRegenerate.length * CONFIG.AI_DELAY / 1000 / 60)} 分钟`);
    console.log('\n   输入 "REGENERATE" 确认重新生成');
    console.log('   按 Ctrl+C 取消操作\n');
    
    process.stdout.write('请输入: ');
    
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toUpperCase();
      
      if (input === 'REGENERATE') {
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
  console.log('🤖 ===== 重新生成AI描述系统 =====\n');
  
  try {
    // 初始化客户端
    await initializeClients();
    
    // 获取需要重新生成的记录
    const recordsToRegenerate = await getRecordsToRegenerate();
    processStats.total = recordsToRegenerate.length;
    
    console.log(`📊 找到 ${recordsToRegenerate.length} 条需要重新生成AI描述的记录\n`);
    
    if (recordsToRegenerate.length === 0) {
      console.log('🎉 所有记录的AI描述都是正确的，无需重新生成！');
      return;
    }
    
    // 显示部分记录预览
    console.log('📋 部分记录预览:');
    recordsToRegenerate.slice(0, 5).forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.filename} - 《${record.book_title}》`);
    });
    if (recordsToRegenerate.length > 5) {
      console.log(`   ... 还有 ${recordsToRegenerate.length - 5} 条记录`);
    }
    
    // 确认操作
    const shouldProceed = await confirmOperation(recordsToRegenerate);
    
    if (!shouldProceed) {
      return;
    }
    
    // 执行重新生成
    console.log('\n🚀 开始重新生成AI描述...\n');
    
    // 分批处理
    for (let i = 0; i < recordsToRegenerate.length; i += CONFIG.BATCH_SIZE) {
      const batch = recordsToRegenerate.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(`\n🔄 处理批次 ${Math.floor(i/CONFIG.BATCH_SIZE) + 1}/${Math.ceil(recordsToRegenerate.length/CONFIG.BATCH_SIZE)}`);
      
      // 串行处理批次内的文件（避免API限流）
      for (let j = 0; j < batch.length; j++) {
        await updateRecordDescription(batch[j], i + j, recordsToRegenerate.length);
        
        // API调用间隔
        if (i + j < recordsToRegenerate.length - 1) {
          console.log(`   ⏳ 等待 ${CONFIG.AI_DELAY/1000} 秒...`);
          await new Promise(resolve => setTimeout(resolve, CONFIG.AI_DELAY));
        }
      }
      
      // 每批次后显示进度报告
      generateProgressReport();
    }
    
    // 显示最终结果
    console.log('\n📊 ===== 重新生成完成 =====');
    console.log(`✅ 成功重新生成: ${processStats.success} 条记录`);
    console.log(`❌ 重新生成失败: ${processStats.failed} 条记录`);
    console.log(`📈 成功率: ${((processStats.success / processStats.total) * 100).toFixed(1)}%`);
    
    if (processStats.failed > 0) {
      console.log('\n⚠️ 失败记录:');
      processStats.failedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.filename}: ${record.error}`);
      });
    }
    
    if (processStats.success > 0) {
      console.log('\n🎉 重新生成完成！现在AI描述将基于正确的书名，更加准确和相关！');
      console.log('💡 建议：');
      console.log('   1. 在前端系统中查看更新后的AI描述');
      console.log('   2. 测试搜索功能的改进效果');
    }
    
  } catch (error) {
    console.error('❌ 重新生成过程失败:', error.message);
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

module.exports = { generateAIDescription, updateRecordDescription }; 