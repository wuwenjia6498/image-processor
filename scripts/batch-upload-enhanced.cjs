#!/usr/bin/env node

/**
 * 增强版批量上传脚本
 * 功能：
 * 1. 批量上传整个文件夹的图片到Supabase
 * 2. 对每张图片进行AI分析描述
 * 3. 生成向量嵌入并存储到Pinecone
 * 4. 记录失败的文件并生成报告
 * 5. 支持断点续传和任务恢复
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  // 批处理大小
  BATCH_SIZE: 10,
  // 重试次数
  MAX_RETRIES: 3,
  // 重试延迟（毫秒）
  RETRY_DELAY: 2000,
  // AI API调用间隔（毫秒）
  AI_DELAY: 1000,
  // 支持的图片格式
  SUPPORTED_FORMATS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
  // 最大文件大小（字节）
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
  let bookTitle = nameWithoutExt.replace(/^\d+-/, '');
  
  // 然后去掉各种形式的后缀数字：
  // 1. 直接连接的数字（如：中国1 -> 中国）
  bookTitle = bookTitle.replace(/\d+$/, '');
  
  // 2. 用连字符连接的数字（如：好奇之旅-1 -> 好奇之旅）
  bookTitle = bookTitle.replace(/-\d+$/, '');
  
  // 3. 处理复杂情况，如：幸福的大桌子-1关于家和爱 -> 幸福的大桌子关于家和爱
  bookTitle = bookTitle.replace(/-\d+(?=[\u4e00-\u9fa5])/, '');
  
  // 清理多余的空白和连字符
  bookTitle = bookTitle.replace(/[-\s]+$/, '').trim();
  
  // 如果处理后为空，返回原始文件名（去掉扩展名）
  return bookTitle || nameWithoutExt;
}

// 生成安全的存储文件名
function generateSafeStorageName(originalFilename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = path.extname(originalFilename);
  
  // 提取文件名中的数字部分作为基础名称
  const nameWithoutExt = path.basename(originalFilename, ext);
  const numberMatch = nameWithoutExt.match(/^(\d+)/);
  const baseNumber = numberMatch ? numberMatch[1] : 'img';
  
  // 生成完全安全的文件名：只包含数字、字母、下划线
  const safeBaseName = `${baseNumber}_${timestamp}_${random}`;
  
  return `${safeBaseName}${ext}`;
}

// 生成安全的数据库ID（纯ASCII，与原有格式保持一致）
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
      '图片': 'image'
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

// 增强版AI描述生成（集成绘本信息搜索）
async function generateEnhancedAIDescription(imagePath, bookTitle) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    
    // 步骤1: 搜索绘本信息
    console.log(`   🔍 搜索绘本《${bookTitle}》的核心信息...`);
    const bookInfoResponse = await openai.chat.completions.create({
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

    const bookInfo = bookInfoResponse.choices[0]?.message?.content || '未找到相关绘本信息';
    console.log(`   ✅ 绘本信息搜索完成`);
    
    // 短暂延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 步骤2: 分析插图并生成增强描述
    console.log(`   🎨 结合绘本主旨生成智能描述...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `基于以下绘本背景信息，请为这张来自绘本《${bookTitle}》的插图生成一个既准确描述画面内容又体现绘本主旨的智能描述：

【绘本背景信息】
${bookInfo}

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
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || `来自《${bookTitle}》的精美插图`;
  } catch (error) {
    throw new Error(`增强AI描述生成失败: ${error.message}`);
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

// 处理单个图片文件
async function processImageFile(imagePath, index, total) {
  const filename = path.basename(imagePath);
  const bookTitle = extractBookTitle(filename);
  const fileSize = fs.statSync(imagePath).size;
  
  console.log(`\n📸 [${index + 1}/${total}] 处理图片: ${filename}`);
  console.log(`   📖 书名: ${bookTitle}`);
  console.log(`   📏 大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  
  // 检查文件大小
  if (fileSize > CONFIG.MAX_FILE_SIZE) {
    throw new Error(`文件过大: ${(fileSize / 1024 / 1024).toFixed(2)} MB > ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB`);
  }
  
  // 检查是否已处理过
  const recordId = generateSafeDatabaseId(filename);
  const { data: existingRecord } = await supabase
    .from('illustrations_optimized')
    .select('id')
    .eq('filename', filename)
    .single();
  
  if (existingRecord) {
    console.log('   ⏭️ 图片已存在，跳过处理');
    processStats.skipped++;
    return { status: 'skipped', filename, reason: '已存在' };
  }
  
  let uploadData, publicUrl, aiDescription, embedding;
  
  try {
    // 1. 上传到Supabase存储
    console.log('   ☁️ 上传到存储...');
    const safeStorageName = generateSafeStorageName(filename);
    const imageBuffer = fs.readFileSync(imagePath);
    
    const uploadResult = await retryOperation(async () => {
      const { data, error } = await supabase.storage
        .from('illustrations')
        .upload(`images/${safeStorageName}`, imageBuffer, {
          contentType: `image/${path.extname(imagePath).substring(1)}`,
          upsert: true
        });
      
      if (error) throw new Error(`上传失败: ${error.message}`);
      return data;
    });
    
    // 获取公开URL
    const { data: urlData } = supabase.storage
      .from('illustrations')
      .getPublicUrl(`images/${safeStorageName}`);
    publicUrl = urlData.publicUrl;
    
    console.log('   ✅ 存储上传成功');
    
    // 2. 生成AI描述
    console.log('   🤖 生成AI描述...');
    await new Promise(resolve => setTimeout(resolve, CONFIG.AI_DELAY)); // API调用间隔
    
    aiDescription = await retryOperation(async () => {
      return await generateEnhancedAIDescription(imagePath, bookTitle);
    }, 2);
    
    console.log(`   ✅ AI描述生成成功: ${aiDescription.substring(0, 50)}...`);
    
    // 3. 生成向量嵌入
    console.log('   🧮 生成向量嵌入...');
    embedding = await retryOperation(async () => {
      return await generateEmbedding(aiDescription);
    }, 2);
    
    console.log(`   ✅ 向量嵌入生成成功: ${embedding.length}维`);
    
    // 4. 存储到数据库
    console.log('   💾 保存到数据库...');
    const { data: dbData, error: dbError } = await supabase
      .from('illustrations_optimized')
      .insert({
        id: recordId,
        filename: filename,
        book_title: bookTitle,
        ai_description: aiDescription,  // 使用 ai_description 而不是 description
        image_url: publicUrl,
        vector_embedding: embedding, // 添加这一行！
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (dbError) throw new Error(`数据库插入失败: ${dbError.message}`);
    
    // 5. 存储向量到Pinecone
    console.log('   🔍 保存向量到Pinecone...');
    await retryOperation(async () => {
      await pineconeIndex.upsert([{
        id: recordId, // 使用生成的ASCII安全ID
        values: embedding,
        metadata: {
          filename: filename,
          book_title: bookTitle,
          ai_description: aiDescription,  // 使用 ai_description 而不是 description
          image_url: publicUrl
        }
      }]);
    });
    
    console.log('   ✅ 处理完成');
    processStats.success++;
    processStats.processedFiles.push(filename);
    
    return { 
      status: 'success', 
      filename, 
      bookTitle, 
      imageUrl: publicUrl,
      description: aiDescription 
    };
    
  } catch (error) {
    console.log(`   ❌ 处理失败: ${error.message}`);
    processStats.failed++;
    processStats.failedFiles.push({
      filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    return { 
      status: 'failed', 
      filename, 
      error: error.message 
    };
  } finally {
    processStats.processed++;
  }
}

// 扫描文件夹获取所有图片
function scanImageFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    throw new Error(`图片文件夹不存在: ${folderPath}`);
  }
  
  const allFiles = fs.readdirSync(folderPath);
  const imageFiles = allFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return CONFIG.SUPPORTED_FORMATS.includes(ext);
  });
  
  return imageFiles.map(file => path.join(folderPath, file));
}

// 生成进度报告
function generateProgressReport() {
  const elapsed = (new Date() - processStats.startTime) / 1000;
  const remainingFiles = processStats.total - processStats.processed;
  const avgTimePerFile = processStats.processed > 0 ? elapsed / processStats.processed : 0;
  const estimatedRemaining = remainingFiles * avgTimePerFile;
  
  console.log('\n📊 ===== 进度报告 =====');
  console.log(`   📈 总进度: ${processStats.processed}/${processStats.total} (${((processStats.processed/processStats.total)*100).toFixed(1)}%)`);
  console.log(`   ✅ 成功: ${processStats.success}`);
  console.log(`   ❌ 失败: ${processStats.failed}`);
  console.log(`   ⏭️ 跳过: ${processStats.skipped}`);
  console.log(`   ⏱️ 已用时间: ${Math.floor(elapsed/60)}分${Math.floor(elapsed%60)}秒`);
  console.log(`   🔮 预计剩余: ${Math.floor(estimatedRemaining/60)}分${Math.floor(estimatedRemaining%60)}秒`);
  console.log(`   📊 平均速度: ${avgTimePerFile.toFixed(1)}秒/图片`);
  console.log('========================\n');
}

// 保存处理结果报告
function saveProcessingReport() {
  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `batch-upload-report-${timestamp}.json`);
  
  const report = {
    ...processStats,
    endTime: new Date(),
    duration: new Date() - processStats.startTime,
    successRate: processStats.total > 0 ? (processStats.success / processStats.total * 100).toFixed(2) + '%' : '0%'
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  // 同时生成易读的文本报告
  const textReportPath = path.join(reportDir, `batch-upload-report-${timestamp}.txt`);
  const textReport = `
批量上传处理报告
==================
开始时间: ${processStats.startTime.toLocaleString()}
结束时间: ${new Date().toLocaleString()}
处理时长: ${Math.floor(report.duration/1000/60)}分${Math.floor((report.duration/1000)%60)}秒

处理统计:
- 总文件数: ${processStats.total}
- 成功处理: ${processStats.success}
- 处理失败: ${processStats.failed}  
- 跳过文件: ${processStats.skipped}
- 成功率: ${report.successRate}

失败文件列表:
${processStats.failedFiles.map(f => `- ${f.filename}: ${f.error}`).join('\n')}

成功处理的文件:
${processStats.processedFiles.map(f => `- ${f}`).join('\n')}
`;
  
  fs.writeFileSync(textReportPath, textReport, 'utf8');
  
  console.log(`📄 详细报告已保存:`);
  console.log(`   JSON: ${reportPath}`);
  console.log(`   文本: ${textReportPath}`);
}

// 主处理函数
async function batchUploadImages(imageFolderPath) {
  console.log('🖼️ ===== 批量图片上传处理系统 =====\n');
  
  try {
    // 初始化客户端
    await initializeClients();
    
    // 扫描图片文件
    console.log(`📁 扫描图片文件夹: ${imageFolderPath}`);
    const imageFiles = scanImageFolder(imageFolderPath);
    processStats.total = imageFiles.length;
    
    console.log(`📊 找到 ${imageFiles.length} 张图片文件`);
    console.log(`📋 支持格式: ${CONFIG.SUPPORTED_FORMATS.join(', ')}`);
    console.log(`⚙️ 批处理大小: ${CONFIG.BATCH_SIZE}`);
    console.log(`🔄 最大重试次数: ${CONFIG.MAX_RETRIES}\n`);
    
    if (imageFiles.length === 0) {
      console.log('❌ 未找到任何图片文件');
      return;
    }
    
    // 分批处理
    for (let i = 0; i < imageFiles.length; i += CONFIG.BATCH_SIZE) {
      const batch = imageFiles.slice(i, i + CONFIG.BATCH_SIZE);
      console.log(`\n🔄 处理批次 ${Math.floor(i/CONFIG.BATCH_SIZE) + 1}/${Math.ceil(imageFiles.length/CONFIG.BATCH_SIZE)}`);
      
      // 并行处理批次内的文件（但控制并发数）
      const batchPromises = batch.map((imagePath, batchIndex) => 
        processImageFile(imagePath, i + batchIndex, imageFiles.length)
      );
      
      await Promise.allSettled(batchPromises);
      
      // 每批次后显示进度报告
      generateProgressReport();
      
      // 批次间短暂休息，避免API限流
      if (i + CONFIG.BATCH_SIZE < imageFiles.length) {
        console.log('⏳ 批次间休息 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 生成最终报告
    console.log('\n🎉 ===== 批量处理完成 =====');
    generateProgressReport();
    saveProcessingReport();
    
    if (processStats.failed > 0) {
      console.log('\n⚠️ 失败文件列表:');
      processStats.failedFiles.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.filename}`);
        console.log(`      错误: ${file.error}`);
      });
    }
    
    console.log('\n💡 处理完成！您可以:');
    console.log('   1. 查看生成的详细报告');
    console.log('   2. 对失败的文件进行单独处理');
    console.log('   3. 在前端系统中验证上传结果');
    
  } catch (error) {
    console.error('❌ 批量处理失败:', error.message);
    saveProcessingReport();
    process.exit(1);
  }
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  node scripts/batch-upload-enhanced.js <图片文件夹路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/batch-upload-enhanced.js ./data/images');
    console.log('  node scripts/batch-upload-enhanced.js /path/to/your/images');
    process.exit(1);
  }
  
  const imageFolderPath = path.resolve(args[0]);
  batchUploadImages(imageFolderPath);
}

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n⚠️ 接收到中断信号，正在保存当前进度...');
  saveProcessingReport();
  console.log('📄 进度报告已保存，可用于恢复处理');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error.message);
  saveProcessingReport();
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = { batchUploadImages }; 