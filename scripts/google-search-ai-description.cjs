#!/usr/bin/env node

/**
 * 使用Serper.dev API的高效AI描述生成器
 * 功能：
 * 1. 使用Serper.dev Google搜索API获取绘本信息
 * 2. 结合AI分析生成准确的绘本描述
 * 3. 超快响应（1-2秒）和极低成本的搜索方案
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  BATCH_SIZE: 4, // Serper更快，可以增加批处理大小
  AI_DELAY: 2000, // AI API调用间隔（毫秒）
  SEARCH_DELAY: 500, // Serper搜索间隔（更短）
  MAX_RETRIES: 3, // 最大重试次数
  RETRY_DELAY: 2000, // 重试延迟
  // Serper搜索配置
  SERPER_SEARCH_TIMEOUT: 5000, // Serper搜索超时时间（更短）
  MAX_SEARCH_RESULTS: 5 // 最大搜索结果数
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
    serperSearchSuccess: 0,
    serperSearchFailed: 0,
    aiBackupUsed: 0,
    totalSearchTime: 0
  }
};

// 初始化客户端
async function initializeClients() {
  console.log('🚀 初始化Serper.dev搜索AI描述生成系统...\n');
  
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

    // 检查Serper搜索API配置
    if (!process.env.SERPER_API_KEY) {
      console.log('⚠️ 未配置Serper搜索API，将使用AI推测模式');
      console.log('💡 要启用Serper搜索，请在.env.local中添加：');
      console.log('   SERPER_API_KEY=your_serper_api_key\n');
    } else {
      console.log('✅ Serper.dev搜索API配置已检测到');
      console.log('⚡ 预期响应时间: 1-2秒，成本极低');
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

// Serper.dev API搜索
async function searchWithSerper(query) {
  return new Promise((resolve, reject) => {
    if (!process.env.SERPER_API_KEY) {
      reject(new Error('Serper搜索API未配置'));
      return;
    }

    const searchQuery = `绘本 "${query}" 故事内容 教育意义 简介`;
    const postData = JSON.stringify({
      q: searchQuery,
      gl: 'cn',
      hl: 'zh',
      num: CONFIG.MAX_SEARCH_RESULTS,
      autocorrect: true
    });

    const options = {
      hostname: 'google.serper.dev',
      port: 443,
      path: '/search',
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const timeout = setTimeout(() => {
      reject(new Error('Serper搜索超时'));
    }, CONFIG.SERPER_SEARCH_TIMEOUT);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(data);
          
          if (result.error) {
            reject(new Error(`Serper API错误: ${result.error}`));
            return;
          }
          
          resolve(result);
        } catch (error) {
          reject(new Error('Serper搜索结果解析失败'));
        }
      });
    });

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// 执行Serper搜索并提取有用信息
async function performSerperSearch(bookTitle) {
  const searchStartTime = Date.now();
  console.log(`   🔍 Serper搜索: 《${bookTitle}》...`);
  
  try {
    const searchResults = await searchWithSerper(bookTitle);
    const searchTime = Date.now() - searchStartTime;
    processStats.searchStats.totalSearchTime += searchTime;
    
    if (!searchResults.organic || searchResults.organic.length === 0) {
      console.log(`   ⚠️ Serper搜索无结果 (${searchTime}ms)`);
      processStats.searchStats.serperSearchFailed++;
      return { summary: '', hasResults: false, isRelevant: false };
    }
    
    // 检查搜索结果的相关性
    let relevantResults = 0;
    let webInfo = '';
    
    // 处理知识图谱信息（如果有）
    if (searchResults.knowledgeGraph) {
      const kg = searchResults.knowledgeGraph;
      if (kg.title) webInfo += `知识图谱标题: ${kg.title}\n`;
      if (kg.description) webInfo += `描述: ${kg.description}\n`;
      webInfo += '\n';
      relevantResults++;
    }
    
    // 处理有机搜索结果
    searchResults.organic.slice(0, CONFIG.MAX_SEARCH_RESULTS).forEach((item, index) => {
      const title = item.title || '';
      const snippet = item.snippet || '';
      
      // 检查结果是否与具体绘本相关（而非通用绘本信息）
      const isRelevant = 
        title.includes(bookTitle) || 
        snippet.includes(bookTitle) ||
        (title.includes('绘本') && snippet.includes('故事') && 
         !title.includes('维基百科') && !title.includes('百度百科') &&
         !title.includes('什么是绘本') && !title.includes('绘本的定义'));
      
      if (isRelevant) {
        relevantResults++;
        webInfo += `${index + 1}. 标题: ${title}\n`;
        webInfo += `   摘要: ${snippet}\n`;
        if (item.link) {
          webInfo += `   链接: ${item.link}\n`;
        }
        webInfo += '\n';
      } else {
        // 记录不相关的结果（用于调试）
        webInfo += `${index + 1}. [通用信息] ${title}\n`;
        webInfo += `   摘要: ${snippet}\n\n`;
      }
    });
    
    // 处理相关问题（如果有）
    if (searchResults.peopleAlsoAsk && searchResults.peopleAlsoAsk.length > 0) {
      const relevantQuestions = searchResults.peopleAlsoAsk.filter(item => 
        item.question && item.question.includes(bookTitle)
      );
      
      if (relevantQuestions.length > 0) {
        webInfo += '相关问题:\n';
        relevantQuestions.slice(0, 2).forEach((item, index) => {
          webInfo += `${index + 1}. ${item.question}\n`;
          if (item.snippet) webInfo += `   ${item.snippet}\n`;
        });
        webInfo += '\n';
        relevantResults += relevantQuestions.length;
      }
    }
    
    // 判断搜索结果是否真正相关
    const isRelevant = relevantResults > 0;
    const resultType = isRelevant ? '相关结果' : '通用结果';
    
    console.log(`   ${isRelevant ? '✅' : '⚠️'} Serper搜索完成 (${searchTime}ms, ${searchResults.organic.length}条结果, ${relevantResults}条${resultType})`);
    
    if (isRelevant) {
      processStats.searchStats.serperSearchSuccess++;
    } else {
      processStats.searchStats.serperSearchFailed++;
    }
    
    return {
      summary: webInfo,
      hasResults: searchResults.organic.length > 0,
      isRelevant: isRelevant,
      relevantCount: relevantResults,
      resultsCount: searchResults.organic.length,
      searchTime: searchTime,
      knowledgeGraph: !!searchResults.knowledgeGraph
    };
    
  } catch (error) {
    const searchTime = Date.now() - searchStartTime;
    processStats.searchStats.totalSearchTime += searchTime;
    console.log(`   ❌ Serper搜索失败: ${error.message} (${searchTime}ms)`);
    processStats.searchStats.serperSearchFailed++;
    return { summary: '', hasResults: false, isRelevant: false };
  }
}

// 步骤1: 综合搜索绘本信息（Serper搜索 + AI推测）
async function searchBookInfoWithSerper(bookTitle) {
  try {
    console.log(`   📚 获取绘本《${bookTitle}》的信息...`);
    
    // 1. 尝试Serper搜索
    const serperSearchResults = await performSerperSearch(bookTitle);
    
    // 2. 使用AI分析Serper搜索结果并补充信息
    const prompt = serperSearchResults.isRelevant 
      ? `基于以下Serper搜索结果和你的知识，请详细介绍绘本《${bookTitle}》：

【Serper搜索结果】
${serperSearchResults.summary}

请结合搜索结果和你的知识，详细介绍以下信息：

1. **故事主题和核心内容**：这本绘本讲述了什么故事？主要情节是什么？

2. **教育意义和价值观**：这本绘本想要传达给儿童什么教育意义？培养什么品质？

3. **艺术风格和视觉特色**：这本绘本的插画风格是什么？色彩特点如何？

4. **目标年龄和适用场景**：适合什么年龄段的儿童？在什么场景下阅读？

5. **情感基调和氛围**：整本书的情感氛围是怎样的？温馨、欢快、感人还是其他？

请优先使用搜索结果中的准确信息，对于搜索结果中没有的信息，请基于书名和你的知识进行合理推测，并明确标注是推测。`
      : `⚠️ 注意：搜索未找到绘本《${bookTitle}》的具体信息，请基于书名进行合理推测：

【搜索情况说明】
搜索返回的主要是通用绘本信息，未找到该绘本的具体内容。

请基于书名《${bookTitle}》进行合理推测，并详细介绍以下信息：

1. **故事主题和核心内容**：基于书名推测，这本绘本可能讲述什么故事？

2. **教育意义和价值观**：这本绘本可能想要传达什么教育意义？

3. **艺术风格和视觉特色**：这类主题的绘本通常采用什么插画风格？

4. **目标年龄和适用场景**：通常适合什么年龄段的儿童？

5. **情感基调和氛围**：基于书名推测的情感氛围？

⚠️ 重要提醒：请在每个部分明确标注这是基于书名的推测，而非确认的绘本信息。用中文回答。`;

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
    
    if (serperSearchResults.isRelevant) {
      const kgInfo = serperSearchResults.knowledgeGraph ? '含知识图谱' : '';
      console.log(`   ✅ 信息获取完成（含真实Serper搜索结果${kgInfo}）`);
    } else if (serperSearchResults.hasResults) {
      console.log(`   ⚠️ AI推测完成（Serper仅返回通用信息）`);
      processStats.searchStats.aiBackupUsed++;
    } else {
      console.log(`   ⚠️ AI推测完成（Serper搜索无结果）`);
      processStats.searchStats.aiBackupUsed++;
    }
    
    return {
      bookInfo,
      serperSearchResults,
      hasWebInfo: serperSearchResults.isRelevant
    };
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
    console.log(`   🎨 生成基于Serper搜索的智能描述...`);
    
    const infoSource = bookInfoResult.hasWebInfo ? 'Serper搜索结果和AI知识' : 'AI知识推测';
    
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

3. **信息融合**：自然地融入搜索获得的绘本信息

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
  
  // 获取所有记录，然后筛选出还没有增强过的
  const { data: allRecords, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, updated_at')
    .order('filename', { ascending: true });
  
  if (error) {
    throw new Error(`获取记录失败: ${error.message}`);
  }
  
  if (!allRecords || allRecords.length === 0) {
    return [];
  }
  
  // 筛选条件：只处理基于书名推测的描述，需要真正增强的记录
  const recordsToEnhance = allRecords.filter(record => {
    const description = record.ai_description || '';
    const updatedDate = new Date(record.updated_at).toDateString();
    const today = new Date().toDateString();
    
    // 判断是否是最近增强的（今天更新的，已经通过Serper增强）
    const isRecentEnhanced = updatedDate === today;
    
    // 判断是否是真正增强过的描述（包含搜索结果特征）
    const hasTrulyEnhanced = 
      description.includes('Serper搜索') || 
      description.includes('Google搜索') ||
      description.includes('网络搜索') ||
      description.includes('搜索结果') ||
      description.includes('基于搜索') ||
      (description.includes('绘本《') && description.includes('讲述') && description.length > 600) ||
      (description.includes('这本绘本') && description.includes('教育意义') && description.includes('故事主题')) ||
      (isRecentEnhanced && description.length > 600); // 最近更新且长度较长的
    
    // 判断是否只是基于书名的推测描述（需要真正增强）
    const needsRealEnhancement = 
      !hasTrulyEnhanced && 
      description.length > 0 &&
      (description.includes('来自《') || 
       description.includes('这幅插图') ||
       description.includes('画面中') ||
       description.includes('展现了')) &&
      !description.includes('这本绘本讲述') &&
      !description.includes('故事的核心') &&
      !description.includes('教育价值在于');
    
    return needsRealEnhancement;
  });
  
  console.log(`📊 总记录数: ${allRecords.length}`);
  console.log(`📊 需要增强的记录: ${recordsToEnhance.length}`);
  console.log(`📊 已完成增强的记录: ${allRecords.length - recordsToEnhance.length}\n`);
  
  return recordsToEnhance || [];
}

// 更新单个记录的增强描述
async function updateRecordEnhancedDescription(record, index, total) {
  console.log(`\n🎯 [${index + 1}/${total}] 增强记录: ${record.filename}`);
  console.log(`   📖 书名: ${record.book_title}`);
  
  try {
    // 步骤1: Serper搜索绘本信息
    const bookInfoResult = await retryOperation(async () => {
      await new Promise(resolve => setTimeout(resolve, CONFIG.SEARCH_DELAY));
      return await searchBookInfoWithSerper(record.book_title);
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

// 显示进度报告（包含Serper搜索统计）
function generateProgressReport() {
  const elapsed = (new Date() - processStats.startTime) / 1000;
  const remainingFiles = processStats.total - processStats.processed;
  const avgTimePerFile = processStats.processed > 0 ? elapsed / processStats.processed : 0;
  const estimatedRemaining = remainingFiles * avgTimePerFile;
  const avgSearchTime = processStats.searchStats.serperSearchSuccess > 0 ? 
    processStats.searchStats.totalSearchTime / processStats.searchStats.serperSearchSuccess : 0;
  
  console.log('\n📊 ===== 进度报告 =====');
  console.log(`   📈 总进度: ${processStats.processed}/${processStats.total} (${((processStats.processed/processStats.total)*100).toFixed(1)}%)`);
  console.log(`   ✅ 成功: ${processStats.success}`);
  console.log(`   ❌ 失败: ${processStats.failed}`);
  console.log(`   ⏱️ 已用时间: ${Math.floor(elapsed/60)}分${Math.floor(elapsed%60)}秒`);
  console.log(`   🔮 预计剩余: ${Math.floor(estimatedRemaining/60)}分${Math.floor(estimatedRemaining%60)}秒`);
  console.log(`   📊 平均速度: ${avgTimePerFile.toFixed(1)}秒/图片`);
  console.log('\n🔍 Serper搜索统计:');
  console.log(`   ✅ 真实绘本信息: ${processStats.searchStats.serperSearchSuccess}`);
  console.log(`   ⚠️ 仅通用信息: ${processStats.searchStats.serperSearchFailed}`);
  console.log(`   🤖 AI后备推测: ${processStats.searchStats.aiBackupUsed}`);
  console.log(`   ⚡ 平均搜索时间: ${avgSearchTime.toFixed(0)}ms`);
  console.log('========================\n');
}

// 确认操作
function confirmOperation(recordsToEnhance) {
  return new Promise((resolve) => {
    const hasSerperAPI = process.env.SERPER_API_KEY;
    
    console.log(`\n❓ 确认要为这 ${recordsToEnhance.length} 条记录生成${hasSerperAPI ? 'Serper搜索增强的' : ''}AI描述吗？`);
    console.log('   这将执行以下步骤：');
    if (hasSerperAPI) {
      console.log('   1. 🔍 通过Serper.dev API获取绘本信息（1-2秒响应）');
    } else {
      console.log('   1. 🤖 使用AI知识推测绘本信息（未配置Serper API）');
    }
    console.log('   2. 👁️ 深度分析插图的画面内容');
    console.log('   3. 🎨 结合绘本信息生成智能描述');
    console.log('   4. 🧮 更新向量嵌入和搜索索引');
    
    const estimatedTime = hasSerperAPI ? 
      Math.ceil(recordsToEnhance.length * 12 / 60) : 
      Math.ceil(recordsToEnhance.length * 10 / 60);
    console.log(`   预计耗时: ${estimatedTime} 分钟`);
    
    if (hasSerperAPI) {
      const estimatedSearches = recordsToEnhance.length;
      const estimatedCost = estimatedSearches * 0.0005; // Serper约$0.50/1000次
      console.log(`   📊 预计Serper搜索: ${estimatedSearches} 次`);
      console.log(`   💰 预计搜索成本: $${estimatedCost.toFixed(3)} USD`);
    }
    
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
  const hasSerperAPI = process.env.SERPER_API_KEY;
  
  console.log('⚡ ===== Serper.dev搜索AI描述生成系统 =====\n');
  console.log('本系统将为每张插图执行以下智能分析流程：');
  if (hasSerperAPI) {
    console.log('⚡ Serper搜索绘本信息 → 🤖 AI分析补充 → 👁️ 画面内容分析 → 🎨 智能描述生成\n');
    console.log('🌟 Serper优势: 1-2秒响应，比Google官方API快10倍，成本低10倍！\n');
  } else {
    console.log('🤖 AI推测绘本信息 → 👁️ 画面内容分析 → 🎨 智能描述生成\n');
  }
  
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
    console.log(`\n🚀 开始${hasSerperAPI ? 'Serper搜索增强' : 'AI推测'}描述生成...\n`);
    
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
        console.log('⏳ 批次间休息 2 秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // 显示最终结果
    console.log(`\n📊 ===== ${hasSerperAPI ? 'Serper搜索增强' : 'AI推测'}处理完成 =====`);
    console.log(`✅ 成功增强: ${processStats.success} 条记录`);
    console.log(`❌ 处理失败: ${processStats.failed} 条记录`);
    console.log(`📈 成功率: ${((processStats.success / processStats.total) * 100).toFixed(1)}%`);
    
    if (hasSerperAPI) {
      console.log('\n⚡ Serper搜索效果统计:');
      console.log(`   ✅ 搜索成功: ${processStats.searchStats.serperSearchSuccess} 次`);
      console.log(`   ❌ 搜索失败: ${processStats.searchStats.serperSearchFailed} 次`);
      console.log(`   🤖 AI后备使用: ${processStats.searchStats.aiBackupUsed} 次`);
      const webSuccessRate = processStats.total > 0 ? 
        (processStats.searchStats.serperSearchSuccess / processStats.total * 100).toFixed(1) : '0';
      console.log(`   📊 Serper信息获取率: ${webSuccessRate}%`);
      
      const avgSearchTime = processStats.searchStats.serperSearchSuccess > 0 ? 
        processStats.searchStats.totalSearchTime / processStats.searchStats.serperSearchSuccess : 0;
      console.log(`   ⚡ 平均搜索时间: ${avgSearchTime.toFixed(0)}ms`);
      const actualCost = (processStats.searchStats.serperSearchSuccess * 0.0005).toFixed(4);
      console.log(`   💰 实际搜索成本: $${actualCost} USD`);
    }
    
    if (processStats.failed > 0) {
      console.log('\n⚠️ 失败记录:');
      processStats.failedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.filename}: ${record.error}`);
      });
    }
    
    if (processStats.success > 0) {
      console.log(`\n🎉 ${hasSerperAPI ? 'Serper搜索增强' : 'AI推测'}完成！现在的AI描述将：`);
      if (hasSerperAPI) {
        console.log('   ⚡ 基于Serper.dev的超快搜索结果（1-2秒响应）');
        console.log('   💰 享受业界最低的搜索成本');
      }
      console.log('   ✨ 准确反映插图的具体画面内容');
      console.log('   📚 深度结合绘本的核心主题和教育价值');
      console.log('   🎨 体现绘本的艺术风格和情感基调');
      console.log('   👶 考虑儿童的阅读视角和理解能力');
      console.log('\n💡 建议：');
      console.log('   1. 在前端系统中查看增强后的AI描述');
      console.log('   2. 对比之前的描述，验证准确性提升');
      console.log('   3. 测试搜索功能的改进效果');
    }
    
  } catch (error) {
    console.error('❌ 处理失败:', error.message);
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
  searchBookInfoWithSerper, 
  analyzeImageContent, 
  generateEnhancedDescription,
  updateRecordEnhancedDescription 
}; 