#!/usr/bin/env node

/**
 * 检查特定记录的AI描述内容
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpecificRecords() {
  console.log('🔍 ===== 检查特定记录的AI描述内容 =====\n');
  
  const targetFiles = [
    '125-一粒种子的旅程：向日葵.jpg',
    '157-外婆家在江南-1.jpg',
    '176-小真的新围裙1.jpg',
    '184-小蝌蚪找妈妈1.jpg',
    '187-小麦开花了.jpg'
  ];
  
  try {
    for (const filename of targetFiles) {
      const { data: records, error } = await supabase
        .from('illustrations_optimized')
        .select('id, filename, book_title, ai_description, updated_at')
        .eq('filename', filename);
      
      if (error) {
        console.error(`❌ 获取记录失败: ${error.message}`);
        continue;
      }
      
      if (!records || records.length === 0) {
        console.log(`❌ 未找到记录: ${filename}`);
        continue;
      }
      
      const record = records[0];
      const description = record.ai_description || '';
      
      console.log(`📋 ${record.filename}`);
      console.log(`   📖 书名: ${record.book_title}`);
      console.log(`   📝 描述长度: ${description.length} 字符`);
      console.log(`   🕐 更新时间: ${new Date(record.updated_at).toLocaleString('zh-CN')}`);
      
      // 检查是否包含绘本主题信息
      const keywords = ['绘本', '教育意义', '故事主题', '这本绘本', '故事讲述', '教育价值'];
      const foundKeywords = keywords.filter(keyword => description.includes(keyword));
      
      console.log(`   🔍 包含关键词: ${foundKeywords.length > 0 ? foundKeywords.join(', ') : '无'}`);
      
      // 显示描述内容的前300字符
      const preview = description.length > 300 
        ? description.substring(0, 300) + '...'
        : description;
      
      console.log(`   📄 描述内容:`);
      console.log(`      ${preview}`);
      console.log('');
    }
    
    console.log('🎉 检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkSpecificRecords();
}

module.exports = { checkSpecificRecords }; 