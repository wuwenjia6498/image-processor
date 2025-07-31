#!/usr/bin/env node

// 测试详细的AI描述生成
const { createClient } = require('@supabase/supabase-js');

async function testAIDescription() {
  try {
    console.log('🧪 测试详细的AI描述生成...\n');
    
    // 初始化Supabase客户端
    const supabaseUrl = 'https://ixdlwnzktpkhwaxeddzh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGx3bnprdHBraHdheGVkZHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQyNDY0MiwiZXhwIjoyMDY5MDAwNjQyfQ.wJUDcntT_JNTE2heAHLsIddo-_UDkhQ5_Q1Zvk5JeiQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('📋 查询现有记录的AI描述...');
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('filename, book_title, ai_description')
      .limit(3);
    
    if (error) {
      console.log('❌ 查询失败:', error.message);
      return;
    }
    
    if (records && records.length > 0) {
      console.log('📊 现有AI描述示例:');
      records.forEach((record, index) => {
        console.log(`\n${index + 1}. ${record.filename}`);
        console.log(`   书名: ${record.book_title}`);
        console.log(`   描述长度: ${record.ai_description.length} 字符`);
        console.log(`   描述预览: ${record.ai_description.substring(0, 100)}...`);
      });
    }
    
    console.log('\n💡 建议:');
    console.log('1. 确保设置了正确的OPENAI_API_KEY环境变量');
    console.log('2. 新的描述将更加详细和具体');
    console.log('3. 包含画面细节、色彩分析、情感氛围等');
    console.log('4. 有助于提高后续文案匹配的精准度');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testAIDescription(); 