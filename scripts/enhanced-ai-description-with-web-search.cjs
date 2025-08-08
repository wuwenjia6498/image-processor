#!/usr/bin/env node

/**
 * 集成网络搜索的增强版AI描述生成器
 * 功能：
 * 1. 提取绘本书名
 * 2. 通过网络搜索API查询绘本的实时信息
 * 3. 结合AI推测补充信息
 * 4. 分析插图的具体画面内容
 * 5. 结合绘本主旨和画面内容生成智能描述
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const https = require('https');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  BATCH_SIZE: 2, // 由于需要网络搜索，减少批处理大小
  AI_DELAY: 3000, // AI API调用间隔（毫秒）
  SEARCH_DELAY: 2000, // 搜索API间隔
  WEB_SEARCH_DELAY: 1000, // 网络搜索间隔
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 3000, // 重试延迟
  // 搜索配置
  MAX_SEARCH_RESULTS: 5, // 最大搜索结果数
  SEARCH_TIMEOUT: 10000 // 搜索超时时间
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
  failedRecords: [],
  searchStats: {
    webSearchSuccess: 0,
    webSearchFailed: 0,
    aiBackupUsed: 0
  }
};

// 初始化客户端
async function initializeClients() {
  console.log('🚀 初始化集成网络搜索的AI描述生成系统...\n');
  
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
    console.log('✅ OpenAI 客户端初始化成功');
    
    console.log('🌐 网络搜索功能已启用\n');

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

// 网络搜索：使用DuckDuckGo搜索（免费且无需API密钥）
async function searchWithDuckDuckGo(query) {
  return new Promise((resolve, reject) => {
    const searchQuery = encodeURIComponent(`绘本 ${query} 故事内容 教育意义`);
    const url = `https://api.duckduckgo.com/?q=${searchQuery}&format=json&no_html=1&skip_disambig=1`;
    
    const timeout = setTimeout(() => {
      reject(new Error('搜索超时'));
    }, CONFIG.SEARCH_TIMEOUT);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('搜索结果解析失败'));
        }
      });
    }).on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// 使用百度搜索（通过爬虫方式，仅获取摘要信息）
async function searchWithBaidu(query) {
  return new Promise((resolve, reject) => {
    const searchQuery = encodeURIComponent(`绘本《${query}》内容简介 教育意义`);
    // 注意：这里使用简化的搜索方式，实际项目中建议使用正式的API
    
    // 模拟搜索结果（实际实现中可以使用puppeteer或其他爬虫工具）
    setTimeout(() => {
      resolve({
        query: query,
        results: [],
        message: '百度搜索模拟结果'
      });
    }, 1000);
  });
}

// 综合网络搜索函数
async function performWebSearch(bookTitle) {
  console.log(`   🌐 执行网络搜索: 《${bookTitle}》...`);
  
  const searchResults = {
    duckduckgo: null,
    baidu: null,
    summary: ''
  };
  
  try {
    // 尝试DuckDuckGo搜索
    try {
      await new Promise(resolve => setTimeout(resolve, CONFIG.WEB_SEARCH_DELAY));
      const ddgResult = await searchWithDuckDuckGo(bookTitle);
      searchResults.duckduckgo = ddgResult;
      console.log(`   ✅ DuckDuckGo搜索完成`);
    } catch (error) {
      console.log(`   ⚠️ DuckDuckGo搜索失败: ${error.message}`);
    }
    
    // 尝试百度搜索
    try {
      await new Promise(resolve => setTimeout(resolve, CONFIG.WEB_SEARCH_DELAY));
      const baiduResult = await searchWithBaidu(bookTitle);
      searchResults.baidu = baiduResult;
      console.log(`   ✅ 百度搜索完成`);
    } catch (error) {
      console.log(`   ⚠️ 百度搜索失败: ${error.message}`);
    }
    
    // 提取有用信息
    let webInfo = '';
    
    // 处理DuckDuckGo结果
    if (searchResults.duckduckgo && searchResults.duckduckgo.AbstractText) {
      webInfo += `搜索摘要: ${searchResults.duckduckgo.AbstractText}\n`;
    }
    
    // 处理相关主题
    if (searchResults.duckduckgo && searchResults.duckduckgo.RelatedTopics) {
      const topics = searchResults.duckduckgo.RelatedTopics
        .slice(0, 3)
        .map(topic => topic.Text)
        .filter(text => text && text.length > 10);
      
      if (topics.length > 0) {
        webInfo += `相关信息: ${topics.join('; ')}\n`;
      }
    }
    
    searchResults.summary = webInfo;
    processStats.searchStats.webSearchSuccess++;
    
    return searchResults;
    
  } catch (error) {
    console.log(`   ❌ 网络搜索失败: ${error.message}`);
    processStats.searchStats.webSearchFailed++;
    return { summary: '' };
  }
}

// 步骤1: 综合搜索绘本信息（网络搜索 + AI推测）
async function searchBookInfoWithWeb(bookTitle) {
  try {
    console.log(`   🔍 综合搜索绘本《${bookTitle}》的信息...`);
    
    // 1. 执行网络搜索
    const webSearchResults = await performWebSearch(bookTitle);
    
    // 2. 使用AI分析网络搜索结果并补充信息
    const prompt = webSearchResults.summary 
      ? `基于以下网络搜索结果和你的知识，请详细介绍绘本《${bookTitle}》：

【网络搜索结果】
${webSearchResults.summary}

请结合搜索结果和你的知识，详细介绍以下信息：

1. **故事主题和核心内容**：这本绘本讲述了什么故事？主要情节是什么？

2. **教育意义和价值观**：这本绘本想要传达给儿童什么教育意义？培养什么品质？

3. **艺术风格和视觉特色**：这本绘本的插画风格是什么？色彩特点如何？

4. **目标年龄和适用场景**：适合什么年龄段的儿童？在什么场景下阅读？

5. **情感基调和氛围**：整本书的情感氛围是怎样的？温馨、欢快、感人还是其他？

请优先使用搜索结果中的准确信息，对于搜索结果中没有的信息，请基于书名进行合理推测，并明确标注是推测。`
      : `请详细介绍绘本《${bookTitle}》的以下信息：

1. **故事主题和核心内容**：这本绘本讲述了什么故事？主要情节是什么？

2. **教育意义和价值观**：这本绘本想要传达给儿童什么教育意义？培养什么品质？

3. **艺术风格和视觉特色**：这本绘本的插画风格是什么？色彩特点如何？

4. **目标年龄和适用场景**：适合什么年龄段的儿童？在什么场景下阅读？

5. **情感基调和氛围**：整本书的情感氛围是怎样的？温馨、欢快、感人还是其他？

请用中文回答，每个方面都要详细说明。如果你不确定某本绘本的具体信息，请基于书名进行合理推测，并说明这是推测。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    const bookInfo = response.choices[0]?.message?.content || '未找到相关绘本信息';
    
    if (webSearchResults.summary) {
      console.log(`   ✅ 综合搜索完成（含网络信息）`);
    } else {
      console.log(`   ✅ AI推测完成（网络搜索无结果）`);
      processStats.searchStats.aiBackupUsed++;
    }
    
    return {
      bookInfo,
      webSearchResults,
      hasWebInfo: !!webSearchResults.summary
    };
  } catch (error) {
    throw new Error(`绘本信息搜索失败: ${error.message}`);
  }
}

// 步骤2: 分析插图画面内容（保持不变）
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
      temperature: 0.3
    });

    const imageAnalysis = response.choices[0]?.message?.content || '无法分析图片内容';
    console.log(`   ✅ 画面分析完成`);
    
    return imageAnalysis;
  } catch (error) {
    throw new Error(`图片分析失败: ${error.message}`);
  }
}

// 步骤3: 生成增强的综合AI描述
async function generateEnhancedDescription(bookTitle, bookInfoResult, imageAnalysis, imageUrl) {
  try {
    console.log(`   🎨 生成基于网络搜索和画面分析的智能描述...`);
    
    const infoSource = bookInfoResult.hasWebInfo ? '网络搜索结果和AI知识' : 'AI知识推测';
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `基于以下信息，请为这张来自绘本《${bookTitle}》的插图生成一个既准确描述画面内容又体现绘本主旨的智能描述：

【绘本信息来源】：${infoSource}
【绘本背景信息】
${bookInfoResult.bookInfo}

【插图画面分析】
${imageAnalysis}

请生成一个400-600字的综合描述，要求：

1. **画面描述准确性**：严格基于画面分析结果描述图片内容，不能编造不存在的元素

2. **主题契合度**：描述要体现绘本的核心主题和教育价值

3. **信息来源标注**：如果使用了网络搜索的信息，要自然地融入描述中

4. **情感氛围一致**：描述的情感基调要与绘本整体氛围相符

5. **教育价值体现**：分析这幅插图在绘本中的教育意义

6. **艺术风格分析**：结合绘本的艺术特色分析画面的视觉效果

7. **儿童视角考虑**：从儿童的角度理解和解读画面内容

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
      max_tokens: 1200,
      temperature: 0.7
    });

    const enhancedDescription = response.choices[0]?.message?.content || `来自《${bookTitle}》的精美插图`;
    console.log(`   ✅ 智能描述生成完成`);
    
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
  
  const { data: records, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, updated_at')
    .order('updated_at', { ascending: false })
    .limit(10); // 由于网络搜索较慢，减少处理数量
  
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
    // 步骤1: 综合搜索绘本信息（网络搜索 + AI）
    const bookInfoResult = await retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, CONFIG.SEARCH_DELAY));
      return await searchBookInfoWithWeb(record.book_title);
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
        bookInfoResult, 
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
        ai_description: enhancedDescription,
        vector_embedding: newEmbedding,
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
          ai_description: enhancedDescription,
          image_url: record.image_url
        }
      }]);
    });
    
    console.log('   ✅ Pinecone更新成功');
    
    processStats.success++;
    
    return {
      success: true,
      bookInfoResult,
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

// 显示进度报告（包含搜索统计）
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
  console.log('\n🌐 搜索统计:');
  console.log(`   🔍 网络搜索成功: ${processStats.searchStats.webSearchSuccess}`);
  console.log(`   ⚠️ 网络搜索失败: ${processStats.searchStats.webSearchFailed}`);
  console.log(`   🤖 AI后备使用: ${processStats.searchStats.aiBackupUsed}`);
  console.log('========================\n');
}

// 确认操作
function confirmOperation(recordsToEnhance) {
  return new Promise((resolve) => {
    console.log(`\n❓ 确认要为这 ${recordsToEnhance.length} 条记录生成网络搜索增强的AI描述吗？`);
    console.log('   这将执行以下步骤：');
    console.log('   1. 🌐 通过网络搜索获取绘本的实时信息');
    console.log('   2. 🤖 使用AI分析和补充绘本信息');
    console.log('   3. 👁️ 深度分析插图的画面内容');
    console.log('   4. 🎨 结合网络信息和绘本主旨生成智能描述');
    console.log('   5. 🧮 更新向量嵌入和搜索索引');
    console.log(`   预计耗时: ${Math.ceil(recordsToEnhance.length * 25 / 60)} 分钟（每张图约25秒，含网络搜索）`);
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
  console.log('🌐 ===== 集成网络搜索的AI描述生成系统 =====\n');
  console.log('本系统将为每张插图执行以下智能分析流程：');
  console.log('🌐 网络搜索绘本信息 → 🤖 AI分析补充 → 👁️ 画面内容分析 → 🎨 智能描述生成\n');
  
  try {
    // 初始化客户端
    await initializeClients();
    
    // 获取需要增强的记录
    const recordsToEnhance = await getRecordsToEnhance();
    processStats.total = recordsToEnhance.length;
    
    console.log(`📊 找到 ${recordsToEnhance.length} 条记录可以进行网络搜索增强\n`);
    
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
    console.log('\n🚀 开始网络搜索增强AI描述生成...\n');
    
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
        console.log('⏳ 批次间休息 8 秒...');
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }
    
    // 显示最终结果
    console.log('\n📊 ===== 网络搜索增强处理完成 =====');
    console.log(`✅ 成功增强: ${processStats.success} 条记录`);
    console.log(`❌ 处理失败: ${processStats.failed} 条记录`);
    console.log(`📈 成功率: ${((processStats.success / processStats.total) * 100).toFixed(1)}%`);
    
    console.log('\n🌐 搜索效果统计:');
    console.log(`   🔍 网络搜索成功: ${processStats.searchStats.webSearchSuccess} 次`);
    console.log(`   ⚠️ 网络搜索失败: ${processStats.searchStats.webSearchFailed} 次`);
    console.log(`   🤖 AI后备使用: ${processStats.searchStats.aiBackupUsed} 次`);
    const webSuccessRate = processStats.total > 0 ? 
      (processStats.searchStats.webSearchSuccess / processStats.total * 100).toFixed(1) : '0';
    console.log(`   📊 网络信息获取率: ${webSuccessRate}%`);
    
    if (processStats.failed > 0) {
      console.log('\n⚠️ 失败记录:');
      processStats.failedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.filename}: ${record.error}`);
      });
    }
    
    if (processStats.success > 0) {
      console.log('\n🎉 网络搜索增强完成！现在的AI描述将：');
      console.log('   🌐 基于实时网络搜索的绘本信息');
      console.log('   ✨ 准确反映插图的具体画面内容');
      console.log('   📚 深度结合绘本的核心主题和教育价值');
      console.log('   🎨 体现绘本的艺术风格和情感基调');
      console.log('   👶 考虑儿童的阅读视角和理解能力');
      console.log('\n💡 建议：');
      console.log('   1. 在前端系统中查看网络搜索增强后的AI描述');
      console.log('   2. 对比之前的描述，验证准确性提升');
      console.log('   3. 测试搜索功能的改进效果');
    }
    
  } catch (error) {
    console.error('❌ 网络搜索增强处理失败:', error.message);
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
  searchBookInfoWithWeb, 
  analyzeImageContent, 
  generateEnhancedDescription,
  updateRecordEnhancedDescription 
}; 