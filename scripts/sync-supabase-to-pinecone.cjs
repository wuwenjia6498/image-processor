#!/usr/bin/env node

const { Pinecone } = require('@pinecone-database/pinecone');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function syncSupabaseToPinecone() {
  console.log('🔄 同步Supabase数据到Pinecone...\n');
  
  try {
    // 初始化客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    // 从Supabase获取所有数据
    console.log('📊 从Supabase获取数据...');
    const { data: records, error } = await supabase
      .from('illustrations')
      .select('*');
    
    if (error) {
      throw new Error(`Supabase查询失败: ${error.message}`);
    }
    
    console.log(`✓ 获取到 ${records.length} 条记录`);
    
    // 批量上传到Pinecone
    console.log('\n🌲 开始上传到Pinecone...');
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // 验证向量数据
        if (!record.vector_embedding || !Array.isArray(record.vector_embedding)) {
          console.log(`⚠️ 跳过 ${record.filename}: 无效的向量数据`);
          failCount++;
          continue;
        }
        
        if (record.vector_embedding.length !== 1024) {
          console.log(`⚠️ 跳过 ${record.filename}: 向量维度不正确 (${record.vector_embedding.length})`);
          failCount++;
          continue;
        }
        
        // 上传到Pinecone
        await index.upsert([{
          id: record.id,
          values: record.vector_embedding,
          metadata: {
            filename: record.filename,
            book_title: record.book_title,
            description: record.ai_description,
            processed_at: record.created_at
          }
        }]);
        
        successCount++;
        console.log(`✅ [${i + 1}/${records.length}] ${record.filename} - ${record.book_title}`);
        
        // 添加小延迟避免API限制
        if (i < records.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        failCount++;
        console.log(`❌ [${i + 1}/${records.length}] ${record.filename} 失败: ${error.message}`);
      }
    }
    
    console.log('\n📊 同步完成统计:');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    console.log(`   📈 成功率: ${Math.round((successCount / records.length) * 100)}%`);
    
    // 验证Pinecone中的数据
    console.log('\n🔍 验证Pinecone数据...');
    const stats = await index.describeIndexStats();
    console.log(`   向量总数: ${stats.totalVectorCount}`);
    console.log(`   索引维度: ${stats.dimension}`);
    
    if (stats.totalVectorCount > 0) {
      console.log('\n🎉 同步成功！Pinecone向量搜索现已可用！');
    } else {
      console.log('\n⚠️ 同步后Pinecone中仍无数据，请检查API配置');
    }
    
  } catch (error) {
    console.log('❌ 同步失败:', error.message);
  }
}

if (require.main === module) {
  syncSupabaseToPinecone();
} 