#!/usr/bin/env node

// 测试数据库表结构
const { createClient } = require('@supabase/supabase-js');

async function testDatabaseSchema() {
  try {
    console.log('🧪 测试数据库表结构...\n');
    
    // 初始化Supabase客户端
    const supabaseUrl = 'https://ixdlwnzktpkhwaxeddzh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGx3bnprdHBraHdheGVkZHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQyNDY0MiwiZXhwIjoyMDY5MDAwNjQyfQ.wJUDcntT_JNTE2heAHLsIddo-_UDkhQ5_Q1Zvk5JeiQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('📋 查询表结构...');
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ 查询失败:', error.message);
      return;
    }
    
    if (records && records.length > 0) {
      const record = records[0];
      console.log('✅ 表结构验证成功！');
      console.log('\n📊 可用字段:');
      Object.keys(record).forEach(field => {
        console.log(`  - ${field}: ${typeof record[field]}`);
      });
    } else {
      console.log('⚠️  表中没有记录，但表存在');
    }
    
    console.log('\n🔍 测试插入一条记录...');
    const testRecord = {
      id: 'test_' + Date.now(),
      filename: 'test.jpg',
      book_title: '测试绘本',
      image_url: 'https://example.com/test.jpg',
      ai_description: '这是一个测试描述',
      age_orientation: '幼儿',
      text_type_fit: '睡前故事',
      vector_embedding: [0.1, 0.2, 0.3],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { error: insertError } = await supabase
      .from('illustrations_optimized')
      .insert(testRecord);
    
    if (insertError) {
      console.log('❌ 插入测试失败:', insertError.message);
    } else {
      console.log('✅ 插入测试成功！');
      
      // 清理测试记录
      await supabase
        .from('illustrations_optimized')
        .delete()
        .eq('id', testRecord.id);
      
      console.log('🧹 测试记录已清理');
    }
    
    console.log('\n🎉 数据库表结构测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testDatabaseSchema(); 