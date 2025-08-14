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

async function checkTableStructure() {
  console.log('🔍 检查 illustrations_optimized 表结构...');
  
  try {
    // 尝试查询一条记录来了解字段结构
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error('❌ 查询失败:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('✅ 表结构字段:');
      Object.keys(data[0]).forEach(field => {
        console.log(`  - ${field}`);
      });
    } else {
      console.log('⚠️ 表为空，尝试插入测试记录来检查字段...');
      
      // 尝试插入一个测试记录来检查字段
      const testData = {
        filename: 'test.jpg',
        book_title: 'test',
        original_description: 'test',
        image_url: 'test'
      };
      
      const { error: insertError } = await supabase
        .from('illustrations_optimized')
        .insert([testData]);
        
      if (insertError) {
        console.error('❌ 插入测试记录失败:', insertError);
        console.log('错误详情:', insertError.message);
      } else {
        console.log('✅ 测试记录插入成功，字段结构正确');
        
        // 删除测试记录
        await supabase
          .from('illustrations_optimized')
          .delete()
          .eq('filename', 'test.jpg');
        console.log('✅ 测试记录已删除');
      }
    }
    
  } catch (error) {
    console.error('❌ 检查过程出错:', error);
  }
}

checkTableStructure();
