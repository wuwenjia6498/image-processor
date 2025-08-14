#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少Supabase配置信息');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProgress() {
  console.log('📊 检查当前处理进度...');
  
  try {
    // 查询总记录数
    const { count, error } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }
    
    console.log(`✅ 数据库中当前有 ${count} 条记录`);
    
    // 查询最近添加的记录
    const { data: recentData, error: recentError } = await supabase
      .from('illustrations_optimized')
      .select('filename, book_title, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (!recentError && recentData) {
      console.log('\n📝 最近添加的5条记录:');
      recentData.forEach((record, index) => {
        const time = new Date(record.created_at).toLocaleString('zh-CN');
        console.log(`  ${index + 1}. ${record.filename} (${record.book_title}) - ${time}`);
      });
    }
    
    // 统计不同书籍的数量
    const { data: bookStats, error: bookError } = await supabase
      .from('illustrations_optimized')
      .select('book_title')
      .order('book_title');
      
    if (!bookError && bookStats) {
      const bookCounts = {};
      bookStats.forEach(record => {
        bookCounts[record.book_title] = (bookCounts[record.book_title] || 0) + 1;
      });
      
      console.log('\n📚 各书籍插图数量:');
      Object.entries(bookCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([book, count]) => {
          console.log(`  - ${book}: ${count}张`);
        });
    }
    
  } catch (error) {
    console.error('❌ 检查过程出错:', error);
  }
}

checkProgress();
