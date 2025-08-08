#!/usr/bin/env node

/**
 * 检查Serper搜索增强后的AI描述效果
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSerperResults() {
  console.log('🔍 ===== Serper搜索增强效果检查 =====\n');
  
  try {
    // 获取最近更新的记录
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, ai_description, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (error) {
      throw new Error(`获取记录失败: ${error.message}`);
    }
    
    if (!records || records.length === 0) {
      console.log('❌ 没有找到记录');
      return;
    }
    
    console.log(`📊 找到 ${records.length} 条最新记录\n`);
    
    records.forEach((record, index) => {
      console.log(`🎯 [${index + 1}] ${record.filename}`);
      console.log(`   📖 书名: ${record.book_title}`);
      console.log(`   🕐 更新时间: ${new Date(record.updated_at).toLocaleString('zh-CN')}`);
      console.log(`   📝 AI描述长度: ${record.ai_description.length} 字符`);
      
      // 显示AI描述的前200个字符
      const preview = record.ai_description.length > 200 
        ? record.ai_description.substring(0, 200) + '...'
        : record.ai_description;
      
      console.log(`   🎨 AI描述预览:`);
      console.log(`      ${preview}`);
      console.log('');
    });
    
    // 分析描述质量指标
    console.log('📈 ===== 质量分析 =====');
    const avgLength = records.reduce((sum, r) => sum + r.ai_description.length, 0) / records.length;
    console.log(`   📏 平均描述长度: ${Math.round(avgLength)} 字符`);
    
    // 检查是否包含搜索相关内容的指标
    const withSearchInfo = records.filter(r => 
      r.ai_description.includes('绘本') || 
      r.ai_description.includes('教育意义') || 
      r.ai_description.includes('故事') ||
      r.ai_description.includes('主题')
    ).length;
    
    console.log(`   🔍 包含绘本主题信息: ${withSearchInfo}/${records.length} (${Math.round(withSearchInfo/records.length*100)}%)`);
    
    // 检查描述的丰富程度
    const richDescriptions = records.filter(r => r.ai_description.length > 400).length;
    console.log(`   📚 丰富描述(>400字): ${richDescriptions}/${records.length} (${Math.round(richDescriptions/records.length*100)}%)`);
    
    console.log('\n🎉 Serper搜索增强检查完成！');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  }
}

// 运行检查
if (require.main === module) {
  checkSerperResults();
}

module.exports = { checkSerperResults }; 