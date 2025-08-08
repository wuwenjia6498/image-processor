#!/usr/bin/env node

/**
 * 分析所有记录的AI描述状态
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAllRecords() {
  console.log('🔍 ===== 分析所有190条记录的AI描述状态 =====\n');
  
  try {
    // 获取所有记录
    const { data: allRecords, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, ai_description, updated_at')
      .order('filename', { ascending: true });
    
    if (error) {
      throw new Error(`获取记录失败: ${error.message}`);
    }
    
    if (!allRecords || allRecords.length === 0) {
      console.log('❌ 没有找到记录');
      return;
    }
    
    console.log(`📊 总记录数: ${allRecords.length}\n`);
    
    // 分析不同类型的描述
    const stats = {
      total: allRecords.length,
      hasDescription: 0,
      shortDescription: 0,  // <300字符
      mediumDescription: 0, // 300-600字符
      longDescription: 0,   // >600字符
      hasBookTheme: 0,      // 包含绘本主题信息
      genericDescription: 0, // 通用描述
      needsEnhancement: 0
    };
    
    const needsEnhancementRecords = [];
    
    allRecords.forEach(record => {
      const description = record.ai_description || '';
      const length = description.length;
      
      if (description) stats.hasDescription++;
      
      if (length < 300) {
        stats.shortDescription++;
      } else if (length < 600) {
        stats.mediumDescription++;
      } else {
        stats.longDescription++;
      }
      
      // 检查是否包含绘本主题信息
      const hasBookTheme = description.includes('绘本') || 
                          description.includes('教育意义') || 
                          description.includes('故事主题') ||
                          description.includes('这本绘本') ||
                          description.includes('教育价值');
      
      if (hasBookTheme) stats.hasBookTheme++;
      
      // 检查是否是通用描述
      const isGeneric = description.includes('来自《') && 
                       description.includes('的精美插图') &&
                       length < 100;
      
      if (isGeneric) stats.genericDescription++;
      
      // 判断是否需要增强
      const needsEnhancement = length < 400 || 
                              !hasBookTheme || 
                              isGeneric ||
                              (description.includes('来自《') && length < 500);
      
      if (needsEnhancement) {
        stats.needsEnhancement++;
        needsEnhancementRecords.push({
          filename: record.filename,
          book_title: record.book_title,
          length: length,
          hasBookTheme: hasBookTheme,
          isGeneric: isGeneric,
          updated_at: record.updated_at
        });
      }
    });
    
    // 显示统计结果
    console.log('📈 ===== 描述长度分布 =====');
    console.log(`   📏 短描述 (<300字): ${stats.shortDescription} 条`);
    console.log(`   📏 中等描述 (300-600字): ${stats.mediumDescription} 条`);
    console.log(`   📏 长描述 (>600字): ${stats.longDescription} 条`);
    
    console.log('\n📈 ===== 内容质量分析 =====');
    console.log(`   ✅ 有AI描述: ${stats.hasDescription} 条`);
    console.log(`   📚 包含绘本主题: ${stats.hasBookTheme} 条`);
    console.log(`   🔧 通用描述: ${stats.genericDescription} 条`);
    console.log(`   ⚠️ 需要增强: ${stats.needsEnhancement} 条`);
    
    console.log('\n📋 ===== 需要增强的记录示例 =====');
    needsEnhancementRecords.slice(0, 10).forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.filename}`);
      console.log(`      📖 书名: ${record.book_title}`);
      console.log(`      📝 长度: ${record.length}字符`);
      console.log(`      🎯 主题: ${record.hasBookTheme ? '有' : '无'}`);
      console.log(`      🔧 通用: ${record.isGeneric ? '是' : '否'}`);
      console.log(`      🕐 更新: ${new Date(record.updated_at).toLocaleString('zh-CN')}`);
      console.log('');
    });
    
    if (needsEnhancementRecords.length > 10) {
      console.log(`   ... 还有 ${needsEnhancementRecords.length - 10} 条记录需要增强\n`);
    }
    
    console.log('🎉 记录分析完成！');
    
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
  }
}

// 运行分析
if (require.main === module) {
  analyzeAllRecords();
}

module.exports = { analyzeAllRecords }; 