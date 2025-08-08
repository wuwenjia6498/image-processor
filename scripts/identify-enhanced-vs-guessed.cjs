#!/usr/bin/env node

/**
 * 区分真正增强过的AI描述和基于书名推测的描述
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function identifyEnhancedVsGuessed() {
  console.log('🔍 ===== 区分真正增强过的AI描述和基于书名推测的描述 =====\n');
  
  try {
    // 获取所有记录
    const { data: allRecords, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, ai_description, updated_at')
      .order('updated_at', { ascending: false });
    
    if (error) {
      throw new Error(`获取记录失败: ${error.message}`);
    }
    
    if (!allRecords || allRecords.length === 0) {
      console.log('❌ 没有找到记录');
      return;
    }
    
    console.log(`📊 总记录数: ${allRecords.length}\n`);
    
    const stats = {
      total: allRecords.length,
      trulyEnhanced: 0,      // 真正增强过的（通过搜索结果）
      bookNameOnly: 0,       // 只包含书名的推测描述
      recentEnhanced: 0,     // 最近增强的（今天更新的）
      needsRealEnhancement: 0 // 需要真正增强的
    };
    
    const trulyEnhancedRecords = [];
    const bookNameOnlyRecords = [];
    const recentEnhancedRecords = [];
    
    // 今天的日期
    const today = new Date().toDateString();
    
    allRecords.forEach(record => {
      const description = record.ai_description || '';
      const updatedDate = new Date(record.updated_at).toDateString();
      
      // 判断是否是最近增强的（今天更新的）
      const isRecentEnhanced = updatedDate === today;
      if (isRecentEnhanced) {
        stats.recentEnhanced++;
        recentEnhancedRecords.push(record);
      }
      
      // 判断是否是真正增强过的描述（包含搜索结果特征）
      const hasTrulyEnhanced = 
        description.includes('Serper搜索') || 
        description.includes('Google搜索') ||
        description.includes('网络搜索') ||
        description.includes('搜索结果') ||
        description.includes('基于搜索') ||
        (description.includes('绘本《') && description.includes('讲述') && description.length > 600) ||
        (description.includes('这本绘本') && description.includes('教育意义') && description.includes('故事主题')) ||
        (isRecentEnhanced && description.length > 600); // 最近更新且长度较长的
      
      // 判断是否只是基于书名的推测描述
      const isBookNameOnly = 
        !hasTrulyEnhanced && 
        (description.includes('来自《') || 
         description.includes('这幅插图') ||
         description.includes('画面中') ||
         description.includes('展现了')) &&
        !description.includes('这本绘本讲述') &&
        !description.includes('故事的核心') &&
        !description.includes('教育价值在于');
      
      if (hasTrulyEnhanced) {
        stats.trulyEnhanced++;
        trulyEnhancedRecords.push({
          filename: record.filename,
          book_title: record.book_title,
          length: description.length,
          updated_at: record.updated_at,
          isRecent: isRecentEnhanced
        });
      } else if (isBookNameOnly) {
        stats.bookNameOnly++;
        stats.needsRealEnhancement++;
        bookNameOnlyRecords.push({
          filename: record.filename,
          book_title: record.book_title,
          length: description.length,
          updated_at: record.updated_at
        });
      }
    });
    
    // 显示统计结果
    console.log('📈 ===== 增强状态分析 =====');
    console.log(`   ✅ 真正增强过的: ${stats.trulyEnhanced} 条 (${(stats.trulyEnhanced/stats.total*100).toFixed(1)}%)`);
    console.log(`   📝 基于书名推测的: ${stats.bookNameOnly} 条 (${(stats.bookNameOnly/stats.total*100).toFixed(1)}%)`);
    console.log(`   🕐 最近增强的: ${stats.recentEnhanced} 条`);
    console.log(`   ⚠️ 需要真正增强: ${stats.needsRealEnhancement} 条`);
    
    console.log('\n📋 ===== 真正增强过的记录示例 =====');
    trulyEnhancedRecords.slice(0, 5).forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.filename}`);
      console.log(`      📖 书名: ${record.book_title}`);
      console.log(`      📝 长度: ${record.length}字符`);
      console.log(`      🕐 更新: ${new Date(record.updated_at).toLocaleString('zh-CN')}`);
      console.log(`      🆕 最近: ${record.isRecent ? '是' : '否'}`);
      console.log('');
    });
    
    console.log('\n📋 ===== 需要真正增强的记录示例 =====');
    bookNameOnlyRecords.slice(0, 5).forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.filename}`);
      console.log(`      📖 书名: ${record.book_title}`);
      console.log(`      📝 长度: ${record.length}字符`);
      console.log(`      🕐 更新: ${new Date(record.updated_at).toLocaleString('zh-CN')}`);
      console.log('');
    });
    
    if (bookNameOnlyRecords.length > 5) {
      console.log(`   ... 还有 ${bookNameOnlyRecords.length - 5} 条记录需要真正增强\n`);
    }
    
    // 建议
    console.log('\n💡 ===== 建议 =====');
    if (stats.needsRealEnhancement > 0) {
      console.log(`   🔧 建议对 ${stats.needsRealEnhancement} 条记录进行Serper搜索增强`);
      console.log(`   ⚡ 预计耗时: ${Math.ceil(stats.needsRealEnhancement * 15 / 60)} 分钟`);
      console.log(`   💰 预计成本: $${(stats.needsRealEnhancement * 0.0005).toFixed(3)} USD`);
    } else {
      console.log('   🎉 所有记录都已真正增强完成！');
    }
    
    console.log('\n🎉 分析完成！');
    
    return {
      stats,
      trulyEnhancedRecords,
      bookNameOnlyRecords
    };
    
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
  }
}

// 运行分析
if (require.main === module) {
  identifyEnhancedVsGuessed();
}

module.exports = { identifyEnhancedVsGuessed }; 