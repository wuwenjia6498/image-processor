#!/usr/bin/env node

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

async function checkPineconeData() {
  console.log('🔍 检查Pinecone中的数据...\n');
  
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    // 获取索引统计信息
    const stats = await index.describeIndexStats();
    console.log('📊 Pinecone索引统计:');
    console.log(`   总向量数: ${stats.totalVectorCount}`);
    console.log(`   索引维度: ${stats.dimension}`);
    console.log(`   索引满度: ${Math.round((stats.totalVectorCount / stats.indexFullness) * 100)}%`);
    
    if (stats.totalVectorCount > 0) {
      // 查询一些样本数据
      console.log('\n🔍 查询样本数据...');
      
      // 创建一个随机向量进行相似性搜索
      const queryVector = Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
      
      const queryResponse = await index.query({
        vector: queryVector,
        topK: 5,
        includeMetadata: true
      });
      
      console.log('\n📋 相似性搜索结果 (前5个):');
      queryResponse.matches.forEach((match, index) => {
        console.log(`${index + 1}. ID: ${match.id}`);
        console.log(`   相似度: ${match.score?.toFixed(4)}`);
        console.log(`   文件名: ${match.metadata?.filename}`);
        console.log(`   绘本: ${match.metadata?.book_title}`);
        console.log(`   描述: ${match.metadata?.description?.substring(0, 50)}...`);
        console.log('');
      });
    } else {
      console.log('\n⚠️ Pinecone中没有找到向量数据');
      console.log('\n可能的原因:');
      console.log('1. 数据还在同步中');
      console.log('2. 向量上传失败');
      console.log('3. 索引配置问题');
    }
    
  } catch (error) {
    console.log('❌ 检查失败:', error.message);
  }
}

if (require.main === module) {
  checkPineconeData();
} 