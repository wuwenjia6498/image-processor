#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSupabaseData() {
  console.log('🔍 检查Supabase中的数据...\n');
  
  try {
    // 检查总记录数
    const { data, error, count } = await supabase
      .from('illustrations')
      .select('*', { count: 'exact' });
    
    if (error) {
      console.log('❌ 查询失败:', error.message);
      return;
    }
    
    console.log(`📊 总记录数: ${count}`);
    
    if (data && data.length > 0) {
      console.log('\n📋 最新的5条记录:');
      data.slice(-5).forEach((record, index) => {
        console.log(`${index + 1}. ${record.filename} - ${record.book_title}`);
        console.log(`   描述: ${record.ai_description?.substring(0, 50)}...`);
        console.log(`   向量维度: ${record.vector_embedding?.length || 'N/A'}`);
        console.log(`   创建时间: ${record.created_at}`);
        console.log('');
      });
      
      // 按绘本分组统计
      console.log('\n📚 按绘本分组统计:');
      const bookStats = {};
      data.forEach(record => {
        const book = record.book_title || '未知';
        bookStats[book] = (bookStats[book] || 0) + 1;
      });
      
      Object.entries(bookStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([book, count]) => {
          console.log(`   ${book}: ${count}张图片`);
        });
        
    } else {
      console.log('⚠️ 没有找到任何记录');
      console.log('\n可能的原因:');
      console.log('1. 数据还未同步到Supabase');
      console.log('2. 表名不正确');
      console.log('3. 权限问题');
    }
    
  } catch (error) {
    console.log('❌ 检查失败:', error.message);
  }
}

if (require.main === module) {
  checkSupabaseData();
} 