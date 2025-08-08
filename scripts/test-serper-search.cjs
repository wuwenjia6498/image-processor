#!/usr/bin/env node

/**
 * 测试Serper搜索《新测试图片》的实际结果
 */

const https = require('https');
require('dotenv').config({ path: '.env.local' });

// 配置参数
const CONFIG = {
  SERPER_SEARCH_TIMEOUT: 8000,
  MAX_SEARCH_RESULTS: 5
};

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

async function testSerperSearch() {
  console.log('🔍 ===== 测试Serper搜索《新测试图片》 =====\n');
  
  const testQueries = [
    '新测试图片',
    '不存在的绘本名称',
    '测试书名123',
    '小红帽' // 真实绘本作为对比
  ];
  
  for (const query of testQueries) {
    console.log(`🔍 测试搜索: 《${query}》`);
    
    try {
      const searchStartTime = Date.now();
      const searchResults = await searchWithSerper(query);
      const searchTime = Date.now() - searchStartTime;
      
      console.log(`   ⏱️ 搜索时间: ${searchTime}ms`);
      
      // 分析搜索结果
      if (!searchResults.organic || searchResults.organic.length === 0) {
        console.log(`   ❌ 无搜索结果`);
      } else {
        console.log(`   ✅ 找到 ${searchResults.organic.length} 条结果`);
        
        // 显示前3条结果
        searchResults.organic.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.title}`);
          console.log(`      ${item.snippet}`);
          console.log(`      ${item.link}`);
          console.log('');
        });
      }
      
      // 检查知识图谱
      if (searchResults.knowledgeGraph) {
        console.log(`   📚 知识图谱: ${searchResults.knowledgeGraph.title}`);
        console.log(`   📝 描述: ${searchResults.knowledgeGraph.description}`);
      } else {
        console.log(`   📚 知识图谱: 无`);
      }
      
      // 检查相关问题
      if (searchResults.peopleAlsoAsk && searchResults.peopleAlsoAsk.length > 0) {
        console.log(`   ❓ 相关问题: ${searchResults.peopleAlsoAsk.length} 个`);
        searchResults.peopleAlsoAsk.slice(0, 2).forEach((item, index) => {
          console.log(`      ${index + 1}. ${item.question}`);
        });
      } else {
        console.log(`   ❓ 相关问题: 无`);
      }
      
    } catch (error) {
      console.log(`   ❌ 搜索失败: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
  
  console.log('🎉 测试完成！');
}

// 运行测试
if (require.main === module) {
  testSerperSearch();
}

module.exports = { testSerperSearch }; 