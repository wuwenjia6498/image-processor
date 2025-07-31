#!/usr/bin/env node

// 测试数据库更新功能
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function testDatabaseUpdate() {
  try {
    console.log('🧪 测试数据库更新功能...\n');
    
    // 配置Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ 环境变量未正确配置');
      console.log(`SUPABASE_URL: ${supabaseUrl ? '已配置' : '未配置'}`);
      console.log(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? '已配置' : '未配置'}`);
      return;
    }
    
    console.log('✅ 环境变量配置正确');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. 测试连接
    console.log('\n🔗 测试数据库连接...');
    const { data: testData, error: testError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, age_orientation, text_type_fit')
      .limit(5);
    
    if (testError) {
      console.log(`❌ 数据库连接失败: ${testError.message}`);
      return;
    }
    
    console.log(`✅ 数据库连接成功，找到 ${testData.length} 条记录`);
    
    // 2. 显示当前数据状态
    console.log('\n📊 当前数据状态:');
    testData.forEach(record => {
      console.log(`   📖 ${record.filename}:`);
      console.log(`      age_orientation: ${record.age_orientation}`);
      console.log(`      text_type_fit: ${record.text_type_fit}`);
    });
    
    // 3. 测试更新功能
    console.log('\n🔄 测试更新功能...');
    
    // 模拟主题匹配函数
    function matchBookTheme(bookTitle) {
      const title = bookTitle.toLowerCase();
      
      if (title.includes('老鼠')) {
        return { age: '幼儿', textType: '睡前故事' };
      }
      if (title.includes('生气')) {
        return { age: '幼儿', textType: '情绪教育' };
      }
      if (title.includes('清明')) {
        return { age: '小学低年级', textType: '传统文化教育' };
      }
      
      return { age: '幼儿', textType: '睡前故事' };
    }
    
    // 更新第一条记录作为测试
    if (testData.length > 0) {
      const firstRecord = testData[0];
      const bookTitle = firstRecord.book_title || firstRecord.filename;
      const theme = matchBookTheme(bookTitle);
      
      console.log(`   📝 更新记录: ${firstRecord.filename}`);
      console.log(`      📖 绘本标题: ${bookTitle}`);
      console.log(`      👶 年龄定位: ${theme.age}`);
      console.log(`      📝 文本类型: ${theme.textType}`);
      
      const { error: updateError } = await supabase
        .from('illustrations_optimized')
        .update({
          age_orientation: theme.age,
          text_type_fit: theme.textType,
          updated_at: new Date().toISOString()
        })
        .eq('id', firstRecord.id);
      
      if (updateError) {
        console.log(`   ❌ 更新失败: ${updateError.message}`);
      } else {
        console.log('   ✅ 更新成功');
      }
    }
    
    // 4. 验证更新结果
    console.log('\n🔍 验证更新结果...');
    const { data: updatedData, error: verifyError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, age_orientation, text_type_fit')
      .limit(5);
    
    if (!verifyError) {
      console.log('📊 更新后的数据状态:');
      updatedData.forEach(record => {
        console.log(`   📖 ${record.filename}:`);
        console.log(`      age_orientation: ${record.age_orientation}`);
        console.log(`      text_type_fit: ${record.text_type_fit}`);
      });
    }
    
    console.log('\n🎉 数据库测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testDatabaseUpdate(); 