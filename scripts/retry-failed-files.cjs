#!/usr/bin/env node

/**
 * 重新处理失败文件脚本
 * 功能：
 * 1. 从批量上传报告中提取失败文件列表
 * 2. 重新处理这些失败的文件
 * 3. 生成新的处理报告
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  MAX_RETRIES: 5,
  RETRY_DELAY: 3000,
  AI_DELAY: 1500,
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

// 全局状态
let processStats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: new Date(),
  failedFiles: [],
  processedFiles: []
};

// 初始化客户端
let supabase, pinecone, openai, pineconeIndex;

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

// 从文件名提取书名
function extractBookTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 首先去掉前缀数字和连字符（如：133-中国1 -> 中国1）
  const withoutPrefix = nameWithoutExt.replace(/^\d+-/, '');
  
  // 去掉后缀数字（如：中国1 -> 中国）
  const withoutSuffix = withoutPrefix.replace(/\d+$/, '');
  
  return withoutSuffix.trim() || nameWithoutExt;
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试机制
async function withRetry(fn, maxRetries = CONFIG.MAX_RETRIES, delayMs = CONFIG.RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.log(`   ⚠️ 第 ${attempt} 次尝试失败: ${error.message}`);
      
      if (attempt < maxRetries) {
        console.log(`   ⏳ ${delayMs}ms 后重试...`);
        await delay(delayMs);
        delayMs *= 1.5; // 指数退避
      }
    }
  }
  
  throw lastError;
}

// 生成AI描述
async function generateAIDescription(imageBuffer, bookTitle, filename) {
  console.log('   🤖 生成AI描述...');
  
  const base64Image = imageBuffer.toString('base64');
  const imageUrl = `data:image/jpeg;base64,${base64Image}`;
  
  const prompt = `请为这张儿童绘本插图生成一个详细的中文描述。

绘本标题：${bookTitle}
文件名：${filename}

请描述：
1. 画面中的主要人物、动物或物体
2. 他们在做什么
3. 场景和背景
4. 色彩和氛围
5. 可能传达的情感或故事情节

请用生动、富有想象力的语言，适合儿童理解。描述应该在100-200字之间。`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.7
  });

  const description = response.choices[0].message.content.trim();
  console.log(`   ✓ AI描述生成成功 (${description.length} 字符)`);
  
  return description;
}

// 生成向量嵌入
async function generateEmbedding(text) {
  console.log('   🔢 生成向量嵌入...');
  
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });
  
  const embedding = response.data[0].embedding;
  console.log(`   ✓ 向量嵌入生成成功 (${embedding.length} 维)`);
  
  return embedding;
}

// 上传图片到Supabase存储
async function uploadImageToStorage(imageBuffer, filename) {
  console.log('   ☁️ 上传图片到存储...');
  
  // 编码文件名
  const encodedFilename = filename.replace(/[^\w\-_.]/g, '_');
  
  const { data, error } = await supabase.storage
    .from('illustrations')
    .upload(`images/${encodedFilename}`, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`存储上传失败: ${error.message}`);
  }

  // 获取公开URL
  const { data: urlData } = supabase.storage
    .from('illustrations')
    .getPublicUrl(`images/${encodedFilename}`);

  console.log(`   ✓ 图片上传成功: ${data.path}`);
  return urlData.publicUrl;
}

// 存储到Pinecone
async function storeToPinecone(id, embedding, metadata) {
  console.log('   📌 存储到Pinecone...');
  
  await pineconeIndex.upsert([{
    id: id,
    values: embedding,
    metadata: metadata
  }]);
  
  console.log('   ✓ Pinecone存储成功');
}

// 存储到Supabase数据库
async function storeToDatabase(data) {
  console.log('   💾 存储到数据库...');
  
  const { data: result, error } = await supabase
    .from('illustrations_optimized')
    .upsert([data], { 
      onConflict: 'filename',
      ignoreDuplicates: false 
    })
    .select();

  if (error) {
    throw new Error(`数据库插入失败: ${error.message}`);
  }

  console.log('   ✓ 数据库存储成功');
  return result[0];
}

// 处理单个文件
async function processSingleFile(filename, imagePath) {
  console.log(`\n📸 处理文件: ${filename}`);
  
  try {
    // 1. 验证文件
    if (!fs.existsSync(imagePath)) {
      throw new Error('文件不存在');
    }
    
    const stats = fs.statSync(imagePath);
    if (stats.size > CONFIG.MAX_FILE_SIZE) {
      throw new Error(`文件过大: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
    }
    
    const ext = path.extname(filename).toLowerCase();
    if (!CONFIG.SUPPORTED_FORMATS.includes(ext)) {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
    
    // 2. 读取图片
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`   📄 文件大小: ${(imageBuffer.length / 1024).toFixed(2)}KB`);
    
    // 3. 提取书名
    const bookTitle = extractBookTitle(filename);
    console.log(`   📖 绘本标题: ${bookTitle}`);
    
    // 4. 上传图片到存储（带重试）
    const imageUrl = await withRetry(() => uploadImageToStorage(imageBuffer, filename));
    
    // 5. 生成AI描述（带重试和延迟）
    await delay(CONFIG.AI_DELAY);
    const aiDescription = await withRetry(() => generateAIDescription(imageBuffer, bookTitle, filename));
    
    // 6. 生成向量嵌入（带重试）
    const combinedText = `${bookTitle} ${aiDescription}`;
    const embedding = await withRetry(() => generateEmbedding(combinedText));
    
    // 7. 准备数据
    const recordData = {
      filename: filename,
      book_title: bookTitle,
      ai_description: aiDescription,
      image_url: imageUrl,
      embedding: embedding,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // 8. 存储到数据库（带重试）
    const dbResult = await withRetry(() => storeToDatabase(recordData));
    
    // 9. 存储到Pinecone（带重试）
    const pineconeMetadata = {
      filename: filename,
      book_title: bookTitle,
      ai_description: aiDescription,
      image_url: imageUrl
    };
    
    await withRetry(() => storeToPinecone(dbResult.id.toString(), embedding, pineconeMetadata));
    
    console.log(`   ✅ 处理完成: ${filename}`);
    
    processStats.success++;
    processStats.processedFiles.push(filename);
    
    return {
      success: true,
      filename: filename,
      data: recordData
    };
    
  } catch (error) {
    console.log(`   ❌ 处理失败: ${error.message}`);
    
    processStats.failed++;
    processStats.failedFiles.push({
      filename: filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      filename: filename,
      error: error.message
    };
  } finally {
    processStats.processed++;
  }
}

// 从报告文件中提取失败文件列表
function extractFailedFilesFromReport(reportPath) {
  console.log(`📄 读取报告文件: ${reportPath}`);
  
  if (!fs.existsSync(reportPath)) {
    throw new Error(`报告文件不存在: ${reportPath}`);
  }
  
  const reportContent = fs.readFileSync(reportPath, 'utf8');
  const lines = reportContent.split('\n');
  
  const failedFiles = [];
  let inFailedSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '失败文件列表:') {
      inFailedSection = true;
      continue;
    }
    
    if (inFailedSection) {
      if (trimmedLine === '' || trimmedLine.startsWith('成功处理的文件:')) {
        break;
      }
      
      // 解析失败文件行，格式如: "- 2574-稀里哗啦下大雨.jpg: 数据库插入失败: TypeError: fetch failed"
      const match = trimmedLine.match(/^-\s*([^:]+):\s*(.+)$/);
      if (match) {
        const filename = match[1].trim();
        const errorMsg = match[2].trim();
        failedFiles.push({
          filename: filename,
          error: errorMsg
        });
      }
    }
  }
  
  console.log(`   找到 ${failedFiles.length} 个失败文件`);
  failedFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file.filename}`);
  });
  
  return failedFiles;
}

// 生成处理报告
function generateReport() {
  const endTime = new Date();
  const duration = Math.round((endTime - processStats.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  
  const timestamp = endTime.toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
  
  // 生成文本报告
  const textReport = `
重新处理失败文件报告
==================
开始时间: ${processStats.startTime.toLocaleString('zh-CN')}
结束时间: ${endTime.toLocaleString('zh-CN')}
处理时长: ${minutes}分${seconds}秒

处理统计:
- 总文件数: ${processStats.total}
- 成功处理: ${processStats.success}
- 处理失败: ${processStats.failed}  
- 跳过文件: ${processStats.skipped}
- 成功率: ${processStats.total > 0 ? ((processStats.success / processStats.total) * 100).toFixed(2) : 0}%

${processStats.failedFiles.length > 0 ? `失败文件列表:
${processStats.failedFiles.map(f => `- ${f.filename}: ${f.error}`).join('\n')}

` : ''}${processStats.processedFiles.length > 0 ? `成功处理的文件:
${processStats.processedFiles.map(f => `- ${f}`).join('\n')}
` : ''}`;

  // 生成JSON报告
  const jsonReport = {
    type: 'retry-failed-files',
    startTime: processStats.startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: duration,
    stats: {
      total: processStats.total,
      success: processStats.success,
      failed: processStats.failed,
      skipped: processStats.skipped,
      successRate: processStats.total > 0 ? ((processStats.success / processStats.total) * 100).toFixed(2) : 0
    },
    failedFiles: processStats.failedFiles,
    processedFiles: processStats.processedFiles
  };

  // 保存报告
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const textReportPath = path.join(reportsDir, `retry-failed-report-${timestamp}.txt`);
  const jsonReportPath = path.join(reportsDir, `retry-failed-report-${timestamp}.json`);

  fs.writeFileSync(textReportPath, textReport, 'utf8');
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2), 'utf8');

  console.log(`\n📊 报告已生成:`);
  console.log(`   📄 文本报告: ${textReportPath}`);
  console.log(`   📋 JSON报告: ${jsonReportPath}`);
  
  return { textReportPath, jsonReportPath };
}

// 主处理函数
async function retryFailedFiles(reportPath, imagesDir) {
  console.log('🔄 ===== 重新处理失败文件 =====\n');
  
  try {
    // 1. 初始化客户端
    await initializeClients();
    
    // 2. 从报告中提取失败文件
    const failedFiles = extractFailedFilesFromReport(reportPath);
    
    if (failedFiles.length === 0) {
      console.log('\n🎉 报告中没有失败文件，无需处理！');
      return;
    }
    
    processStats.total = failedFiles.length;
    
    console.log(`\n📋 准备重新处理 ${failedFiles.length} 个失败文件`);
    console.log(`📁 图片目录: ${imagesDir}\n`);
    
    // 3. 逐个处理失败文件
    for (let i = 0; i < failedFiles.length; i++) {
      const { filename } = failedFiles[i];
      const imagePath = path.join(imagesDir, filename);
      
      console.log(`\n[${i + 1}/${failedFiles.length}] 重新处理: ${filename}`);
      
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        console.log(`   ⚠️ 文件不存在，跳过: ${imagePath}`);
        processStats.skipped++;
        continue;
      }
      
      // 处理文件
      await processSingleFile(filename, imagePath);
      
      // 显示进度
      const progress = ((i + 1) / failedFiles.length * 100).toFixed(1);
      console.log(`   📈 进度: ${progress}% (${processStats.success}成功/${processStats.failed}失败/${processStats.skipped}跳过)`);
      
      // 短暂延迟，避免API限制
      if (i < failedFiles.length - 1) {
        await delay(500);
      }
    }
    
    // 4. 生成报告
    console.log('\n📊 生成处理报告...');
    const reports = generateReport();
    
    // 5. 显示最终统计
    console.log('\n🎯 最终统计:');
    console.log(`   ✅ 成功: ${processStats.success} 个文件`);
    console.log(`   ❌ 失败: ${processStats.failed} 个文件`);
    console.log(`   ⏭️ 跳过: ${processStats.skipped} 个文件`);
    console.log(`   📈 成功率: ${processStats.total > 0 ? ((processStats.success / processStats.total) * 100).toFixed(2) : 0}%`);
    
    if (processStats.success > 0) {
      console.log('\n🎉 重新处理完成！');
    } else {
      console.log('\n⚠️ 没有文件成功处理，请检查错误信息');
    }
    
  } catch (error) {
    console.error('\n❌ 重新处理失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('重新处理失败文件工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/retry-failed-files.cjs <报告文件路径> <图片目录路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/retry-failed-files.cjs reports/batch-upload-report-2025-08-13T16-36-50-030Z.txt data/images');
    process.exit(1);
  }
  
  const reportPath = path.resolve(args[0]);
  const imagesDir = path.resolve(args[1]);
  
  if (!fs.existsSync(reportPath)) {
    console.error(`❌ 报告文件不存在: ${reportPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ 图片目录不存在: ${imagesDir}`);
    process.exit(1);
  }
  
  retryFailedFiles(reportPath, imagesDir);
}

if (require.main === module) {
  main();
}

module.exports = { retryFailedFiles };
