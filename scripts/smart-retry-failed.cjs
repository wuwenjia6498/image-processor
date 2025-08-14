#!/usr/bin/env node

/**
 * 智能重试失败文件脚本
 * 专门处理批量上传中失败的文件，包含：
 * 1. 更智能的重试机制
 * 2. 详细的错误分析
 * 3. 分步骤处理，便于定位问题
 * 4. 网络连接检测
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
  RETRY_DELAY: 5000, // 增加重试延迟
  AI_DELAY: 2000,
  NETWORK_TIMEOUT: 30000,
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
  processedFiles: [],
  errorAnalysis: {}
};

// 初始化客户端
let supabase, pinecone, openai, pineconeIndex;

// 网络连接检测
async function checkNetworkConnection() {
  console.log('🌐 检测网络连接...');
  
  try {
    // 测试Supabase连接
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      throw new Error(`Supabase连接失败: ${error.message}`);
    }
    
    console.log('✅ Supabase连接正常');
    
    // 测试OpenAI连接
    const testResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "测试连接" }],
      max_tokens: 10
    });
    
    console.log('✅ OpenAI连接正常');
    
    return true;
  } catch (error) {
    console.log(`❌ 网络连接检测失败: ${error.message}`);
    return false;
  }
}

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
      baseURL: process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
      timeout: CONFIG.NETWORK_TIMEOUT
    });
    console.log('✅ OpenAI 客户端初始化成功\n');

    // 检测网络连接
    const networkOk = await checkNetworkConnection();
    if (!networkOk) {
      console.log('⚠️ 网络连接可能有问题，但继续尝试处理...\n');
    }

  } catch (error) {
    console.error('❌ 客户端初始化失败:', error.message);
    process.exit(1);
  }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 智能重试机制
async function smartRetry(operation, operationName, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError;
  let delayMs = CONFIG.RETRY_DELAY;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   🔄 ${operationName} (尝试 ${attempt}/${maxRetries})...`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`   ⚠️ ${operationName} 失败: ${error.message}`);
      
      // 分析错误类型
      const errorType = analyzeError(error);
      console.log(`   📊 错误类型: ${errorType}`);
      
      if (attempt < maxRetries) {
        // 根据错误类型调整重试策略
        const adjustedDelay = adjustDelayForError(errorType, delayMs, attempt);
        console.log(`   ⏳ ${adjustedDelay}ms 后重试...`);
        await delay(adjustedDelay);
        delayMs *= 1.5; // 指数退避
      }
    }
  }
  
  throw lastError;
}

// 错误分析
function analyzeError(error) {
  const message = error.message.toLowerCase();
  
  if (message.includes('fetch failed') || message.includes('network') || message.includes('connection')) {
    return 'NETWORK_ERROR';
  } else if (message.includes('timeout') || message.includes('terminated')) {
    return 'TIMEOUT_ERROR';
  } else if (message.includes('rate limit') || message.includes('quota') || message.includes('429')) {
    return 'RATE_LIMIT_ERROR';
  } else if (message.includes('authentication') || message.includes('unauthorized') || message.includes('401')) {
    return 'AUTH_ERROR';
  } else if (message.includes('file') || message.includes('not found') || message.includes('404')) {
    return 'FILE_ERROR';
  } else {
    return 'UNKNOWN_ERROR';
  }
}

// 根据错误类型调整延迟
function adjustDelayForError(errorType, baseDelay, attempt) {
  switch (errorType) {
    case 'RATE_LIMIT_ERROR':
      return baseDelay * 2; // 限流错误，增加延迟
    case 'NETWORK_ERROR':
      return baseDelay * 1.5; // 网络错误，适度增加延迟
    case 'TIMEOUT_ERROR':
      return baseDelay; // 超时错误，保持原延迟
    default:
      return baseDelay;
  }
}

// 从文件名提取书名
function extractBookTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const withoutPrefix = nameWithoutExt.replace(/^\d+-/, '');
  const withoutSuffix = withoutPrefix.replace(/\d+$/, '');
  return withoutSuffix.trim() || nameWithoutExt;
}

// 生成安全的数据库ID（与原有格式保持一致）
function generateSafeDatabaseId(originalFilename) {
  const nameWithoutExt = path.basename(originalFilename, path.extname(originalFilename));
  
  // 提取数字部分
  const numberMatch = nameWithoutExt.match(/^(\d+)/);
  const baseNumber = numberMatch ? numberMatch[1] : 'img';
  
  // 提取中文部分并转换为拼音或简化标识
  const chinesePart = nameWithoutExt.replace(/^\d+-?/, '');
  
  // 生成简化的英文标识
  let englishPart = '';
  if (chinesePart) {
    // 简单的中文到英文映射（可根据需要扩展）
    const chineseToEnglish = {
      '圣诞': 'christmas',
      '老鼠': 'mouse', 
      '冬天': 'winter',
      '手套': 'glove',
      '红': 'red',
      '城市': 'city',
      '小': 'small',
      '大': 'big',
      '树': 'tree',
      '和平': 'peace',
      '非洲': 'africa',
      '故事': 'story',
      '真实': 'true',
      '动物': 'animal',
      '世界': 'world',
      '家人': 'family',
      '餐厅': 'restaurant',
      '认真': 'serious',
      '图书馆': 'library',
      '诞生': 'birth',
      '种子': 'seed',
      '旅程': 'journey',
      '向日葵': 'sunflower',
      '小猪': 'pig',
      '上山': 'mountain',
      '下雨': 'rain',
      '测试': 'test',
      '图片': 'image',
      '稀里哗啦': 'rain',
      '端午': 'dragon',
      '粽米香': 'rice',
      '红色': 'red',
      '最棒': 'best',
      '米芾': 'calligraphy',
      '练字': 'writing',
      '美丽': 'beautiful',
      '星期五': 'friday',
      '菊花': 'chrysanthemum',
      '蜜': 'honey',
      '蓉蓉': 'rongrong',
      '气球': 'balloon',
      '蓝色': 'blue',
      '小苍蝇': 'fly',
      '二十四节气': 'solar_terms',
      '迟到': 'late',
      '大王': 'king',
      '逃家': 'runaway',
      '小兔': 'rabbit'
    };
    
    // 尝试匹配关键词
    for (const [chinese, english] of Object.entries(chineseToEnglish)) {
      if (chinesePart.includes(chinese)) {
        englishPart = english;
        break;
      }
    }
    
    // 如果没有匹配到，使用文件名长度作为标识
    if (!englishPart) {
      englishPart = `file_${chinesePart.length}`;
    }
  }
  
  // 生成最终ID：数字_英文标识_扩展名
  const ext = path.extname(originalFilename).substring(1); // 去掉点号
  return `${baseNumber}_${englishPart}_${ext}`.toLowerCase();
}

// 生成安全的存储文件名
function generateSafeStorageName(originalFilename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = path.extname(originalFilename);
  
  const nameWithoutExt = path.basename(originalFilename, ext);
  const numberMatch = nameWithoutExt.match(/^(\d+)/);
  const baseNumber = numberMatch ? numberMatch[1] : 'img';
  
  const safeBaseName = `${baseNumber}_${timestamp}_${random}`;
  return `${safeBaseName}${ext}`;
}

// 上传图片到Supabase存储
async function uploadImageToStorage(imageBuffer, filename) {
  const encodedFilename = generateSafeStorageName(filename);
  
  const { data, error } = await supabase.storage
    .from('illustrations')
    .upload(`images/${encodedFilename}`, imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    throw new Error(`存储上传失败: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('illustrations')
    .getPublicUrl(`images/${encodedFilename}`);

  console.log(`   ✓ 图片上传成功: ${data.path}`);
  return urlData.publicUrl;
}

// 生成AI描述
async function generateAIDescription(imageBuffer, bookTitle, filename) {
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
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });
  
  const embedding = response.data[0].embedding;
  console.log(`   ✓ 向量嵌入生成成功 (${embedding.length} 维)`);
  
  return embedding;
}

// 存储到Pinecone
async function storeToPinecone(id, embedding, metadata) {
  await pineconeIndex.upsert([{
    id: id,
    values: embedding,
    metadata: metadata
  }]);
  
  console.log('   ✓ Pinecone存储成功');
}

// 存储到Supabase数据库
async function storeToDatabase(data) {
  const { data: result, error } = await supabase
    .from('illustrations_optimized')
    .upsert([data], { 
      onConflict: 'id',  // 使用主键字段
      ignoreDuplicates: false 
    })
    .select();

  if (error) {
    throw new Error(`数据库插入失败: ${error.message}`);
  }

  console.log('   ✓ 数据库存储成功');
  return result[0];
}

// 分步骤处理单个文件
async function processSingleFileStepByStep(filename, imagePath) {
  console.log(`\n📸 处理文件: ${filename}`);
  
  try {
    // 步骤1: 验证文件
    console.log('   🔍 步骤1: 验证文件...');
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
    
    console.log(`   ✓ 文件验证通过 (${(stats.size / 1024).toFixed(2)}KB)`);
    
    // 步骤2: 读取图片
    console.log('   📄 步骤2: 读取图片...');
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`   ✓ 图片读取成功`);
    
    // 步骤3: 提取书名
    const bookTitle = extractBookTitle(filename);
    console.log(`   📖 绘本标题: ${bookTitle}`);
    
    // 步骤4: 上传图片到存储（带重试）
    const imageUrl = await smartRetry(
      () => uploadImageToStorage(imageBuffer, filename),
      '图片上传'
    );
    
    // 步骤5: 生成AI描述（带重试和延迟）
    await delay(CONFIG.AI_DELAY);
    const aiDescription = await smartRetry(
      () => generateAIDescription(imageBuffer, bookTitle, filename),
      'AI描述生成'
    );
    
    // 步骤6: 生成向量嵌入（带重试）
    const combinedText = `${bookTitle} ${aiDescription}`;
    const embedding = await smartRetry(
      () => generateEmbedding(combinedText),
      '向量嵌入生成'
    );
    
    // 步骤7: 准备数据
    const recordData = {
      id: generateSafeDatabaseId(filename),  // 生成正确的ID
      filename: filename,
      book_title: bookTitle,
      original_description: aiDescription,  // 使用新的字段名
      image_url: imageUrl,
      original_embedding: embedding,  // 使用新的字段名
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // 步骤8: 存储到数据库（带重试）
    const dbResult = await smartRetry(
      () => storeToDatabase(recordData),
      '数据库存储'
    );
    
    // 步骤9: 存储到Pinecone（带重试）
    const pineconeMetadata = {
      filename: filename,
      book_title: bookTitle,
      original_description: aiDescription,  // 使用新的字段名
      image_url: imageUrl
    };
    
    await smartRetry(
      () => storeToPinecone(dbResult.id.toString(), embedding, pineconeMetadata),
      'Pinecone存储'
    );
    
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
    
    // 记录详细的错误信息
    const errorType = analyzeError(error);
    if (!processStats.errorAnalysis[errorType]) {
      processStats.errorAnalysis[errorType] = [];
    }
    processStats.errorAnalysis[errorType].push({
      filename: filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    processStats.failed++;
    processStats.failedFiles.push({
      filename: filename,
      error: error.message,
      errorType: errorType,
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      filename: filename,
      error: error.message,
      errorType: errorType
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
智能重试失败文件报告
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

错误分析:
${Object.entries(processStats.errorAnalysis).map(([errorType, files]) => 
  `${errorType}: ${files.length} 个文件`
).join('\n')}

${processStats.failedFiles.length > 0 ? `失败文件列表:
${processStats.failedFiles.map(f => `- ${f.filename}: ${f.error} (${f.errorType})`).join('\n')}

` : ''}${processStats.processedFiles.length > 0 ? `成功处理的文件:
${processStats.processedFiles.map(f => `- ${f}`).join('\n')}
` : ''}`;

  // 生成JSON报告
  const jsonReport = {
    type: 'smart-retry-failed-files',
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
    errorAnalysis: processStats.errorAnalysis,
    failedFiles: processStats.failedFiles,
    processedFiles: processStats.processedFiles
  };

  // 保存报告
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const textReportPath = path.join(reportsDir, `smart-retry-report-${timestamp}.txt`);
  const jsonReportPath = path.join(reportsDir, `smart-retry-report-${timestamp}.json`);

  fs.writeFileSync(textReportPath, textReport, 'utf8');
  fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2), 'utf8');

  console.log(`\n📊 报告已生成:`);
  console.log(`   📄 文本报告: ${textReportPath}`);
  console.log(`   📋 JSON报告: ${jsonReportPath}`);
  
  return { textReportPath, jsonReportPath };
}

// 主处理函数
async function smartRetryFailedFiles(reportPath, imagesDir) {
  console.log('🔄 ===== 智能重试失败文件 =====\n');
  
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
    
    console.log(`\n📋 准备智能重试处理 ${failedFiles.length} 个失败文件`);
    console.log(`📁 图片目录: ${imagesDir}\n`);
    
    // 3. 逐个处理失败文件
    for (let i = 0; i < failedFiles.length; i++) {
      const { filename } = failedFiles[i];
      const imagePath = path.join(imagesDir, filename);
      
      console.log(`\n[${i + 1}/${failedFiles.length}] 智能重试: ${filename}`);
      
      // 检查文件是否存在
      if (!fs.existsSync(imagePath)) {
        console.log(`   ⚠️ 文件不存在，跳过: ${imagePath}`);
        processStats.skipped++;
        continue;
      }
      
      // 分步骤处理文件
      await processSingleFileStepByStep(filename, imagePath);
      
      // 显示进度
      const progress = ((i + 1) / failedFiles.length * 100).toFixed(1);
      console.log(`   📈 进度: ${progress}% (${processStats.success}成功/${processStats.failed}失败/${processStats.skipped}跳过)`);
      
      // 短暂延迟，避免API限制
      if (i < failedFiles.length - 1) {
        await delay(1000);
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
    
    // 显示错误分析
    if (Object.keys(processStats.errorAnalysis).length > 0) {
      console.log('\n📊 错误类型分析:');
      Object.entries(processStats.errorAnalysis).forEach(([errorType, files]) => {
        console.log(`   ${errorType}: ${files.length} 个文件`);
      });
    }
    
    if (processStats.success > 0) {
      console.log('\n🎉 智能重试完成！');
    } else {
      console.log('\n⚠️ 没有文件成功处理，请检查错误分析');
    }
    
  } catch (error) {
    console.error('\n❌ 智能重试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('智能重试失败文件工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/smart-retry-failed.cjs <报告文件路径> <图片目录路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/smart-retry-failed.cjs reports/batch-upload-report-2025-08-13T16-36-50-030Z.txt data/images');
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
  
  smartRetryFailedFiles(reportPath, imagesDir);
}

if (require.main === module) {
  main();
}

module.exports = { smartRetryFailedFiles };
