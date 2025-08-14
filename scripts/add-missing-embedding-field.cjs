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

async function addMissingField() {
  console.log('🔧 添加缺失的 creative_play_embedding 字段...');
  
  try {
    // 尝试插入一个包含 creative_play_embedding 的测试记录
    const testData = {
      filename: 'test-embedding.jpg',
      book_title: 'test',
      original_description: 'test',
      image_url: 'test',
      creative_play_embedding: [0.1, 0.2, 0.3] // 测试embedding字段
    };
    
    const { error: insertError } = await supabase
      .from('illustrations_optimized')
      .insert([testData]);
      
    if (insertError) {
      console.error('❌ creative_play_embedding 字段缺失:', insertError.message);
      console.log('需要手动在Supabase控制台中添加此字段');
      console.log('字段类型: vector(1536)');
    } else {
      console.log('✅ creative_play_embedding 字段存在');
      
      // 删除测试记录
      await supabase
        .from('illustrations_optimized')
        .delete()
        .eq('filename', 'test-embedding.jpg');
      console.log('✅ 测试记录已删除');
    }
    
  } catch (error) {
    console.error('❌ 检查过程出错:', error);
  }
}

addMissingField();
