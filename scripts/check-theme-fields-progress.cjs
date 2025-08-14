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

async function checkThemeFieldsProgress() {
  console.log('📊 检查7个主题字段的处理进度...\n');
  
  try {
    // 查询总记录数
    const { count: totalRecords, error: countError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ 查询总记录数失败:', countError);
      return;
    }
    
    // 查询已完成主题字段处理的记录数
    const { count: completedRecords, error: completedError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true })
      .not('theme_philosophy', 'is', null);
      
    if (completedError) {
      console.error('❌ 查询已完成记录数失败:', completedError);
      return;
    }
    
    // 查询未完成主题字段处理的记录数
    const { count: pendingRecords, error: pendingError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true })
      .is('theme_philosophy', null);
      
    if (pendingError) {
      console.error('❌ 查询待处理记录数失败:', pendingError);
      return;
    }
    
    // 查询最近完成的记录
    const { data: recentCompleted, error: recentError } = await supabase
      .from('illustrations_optimized')
      .select('filename, book_title, updated_at, theme_philosophy')
      .not('theme_philosophy', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5);
      
    console.log('🎯 7个主题字段处理进度');
    console.log('================================');
    console.log(`📁 总记录数: ${totalRecords}`);
    console.log(`✅ 已完成主题分析: ${completedRecords} 条`);
    console.log(`⏳ 待处理: ${pendingRecords} 条`);
    console.log(`📈 完成率: ${((completedRecords / totalRecords) * 100).toFixed(1)}%`);
    
    if (recentCompleted && recentCompleted.length > 0) {
      console.log('\n📝 最近完成主题分析的记录:');
      recentCompleted.forEach((record, index) => {
        const time = new Date(record.updated_at).toLocaleString('zh-CN');
        const preview = record.theme_philosophy ? record.theme_philosophy.substring(0, 30) + '...' : '';
        console.log(`  ${index + 1}. ${record.filename} (${record.book_title}) - ${time}`);
        console.log(`     主题哲理: ${preview}`);
      });
    }
    
    // 查询待处理记录的示例
    if (pendingRecords > 0) {
      const { data: pendingExamples, error: pendingExError } = await supabase
        .from('illustrations_optimized')
        .select('filename, book_title')
        .is('theme_philosophy', null)
        .limit(5);
        
      if (!pendingExError && pendingExamples) {
        console.log('\n⏳ 待处理记录示例:');
        pendingExamples.forEach((record, index) => {
          console.log(`  ${index + 1}. ${record.filename} (${record.book_title})`);
        });
      }
    }
    
    if (pendingRecords === 0) {
      console.log('\n🎉 所有记录的7个主题字段都已完成处理！');
    } else {
      console.log(`\n💡 Python脚本正在处理中，还需处理 ${pendingRecords} 条记录`);
    }
    
  } catch (error) {
    console.error('❌ 检查进度时出错:', error);
  }
}

checkThemeFieldsProgress();
