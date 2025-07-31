#!/usr/bin/env node

// 测试前端数据库连接
const { createClient } = require('@supabase/supabase-js');

async function testFrontendDatabase() {
  try {
    console.log('🧪 测试前端数据库连接...\n');
    
    // 使用相同的配置
    const supabaseUrl = 'https://ixdlwnzktpkhwaxeddzh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGx3bnprdHBraHdheGVkZHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQyNDY0MiwiZXhwIjoyMDY5MDAwNjQyfQ.wJUDcntT_JNTE2heAHLsIddo-_UDkhQ5_Q1Zvk5JeiQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🔗 测试数据库连接...');
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, age_orientation, text_type_fit, created_at')
      .limit(5);
    
    if (error) {
      console.log('❌ 数据库连接失败:', error.message);
      return;
    }
    
    console.log('✅ 数据库连接成功！');
    console.log(`📊 查询到 ${data.length} 条记录\n`);
    
    if (data.length > 0) {
      console.log('📋 前5条记录:');
      data.forEach((record, index) => {
        console.log(`${index + 1}. ${record.filename}`);
        console.log(`   书名: ${record.book_title}`);
        console.log(`   年龄: ${record.age_orientation}`);
        console.log(`   类型: ${record.text_type_fit}`);
        console.log(`   创建: ${new Date(record.created_at).toLocaleString('zh-CN')}`);
        console.log('');
      });
    }
    
    console.log('🎉 前端数据库连接测试完成！');
    console.log('💡 现在您可以在Web界面中点击"查看数据库"按钮查看完整记录。');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testFrontendDatabase(); 