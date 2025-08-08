#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

console.log('🔧 快速向量补充工具\n');

// 检查环境变量
console.log('🔍 检查环境变量...');
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`❌ 缺少环境变量: ${varName}`);
    process.exit(1);
  }
  console.log(`✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
}

async function quickFixVectors() {
  try {
    // 初始化客户端
    console.log('\n🚀 初始化客户端...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const openai = new OpenAI({
      apiKey: process.env.VITE_OPENAI_API_KEY,
      baseURL: process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
    });
    
    console.log('✅ 客户端初始化成功');
    
    // 查找缺少向量的记录
    console.log('\n🔍 查找缺少向量的记录...');
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, ai_description')
      .is('vector_embedding', null)
     
      
    if (error) throw error;
    
    console.log(`📊 找到 ${records?.length || 0} 条缺少向量的记录`);
    
    if (!records || records.length === 0) {
      console.log('🎉 所有记录都已有向量数据！');
      return;
    }
    
    // 处理记录
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      console.log(`\n📝 [${i + 1}/${records.length}] ${record.filename}`);
      
      try {
        // 生成向量
        console.log('   🧮 生成向量...');
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: record.ai_description,
          dimensions: 1536
        });
        
        const embedding = response.data[0].embedding;
        console.log(`   ✅ 向量生成成功: ${embedding.length}维`);
        
        // 更新数据库
        console.log('   💾 更新数据库...');
        const { error: updateError } = await supabase
          .from('illustrations_optimized')
          .update({ vector_embedding: embedding })
          .eq('id', record.id);
        
        if (updateError) throw updateError;
        console.log('   ✅ 数据库更新成功');
        
        // 等待1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ 处理失败: ${error.message}`);
      }
    }
    
    console.log('\n🎉 处理完成！');
    
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  }
}

quickFixVectors();