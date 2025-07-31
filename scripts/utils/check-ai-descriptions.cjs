#!/usr/bin/env node

// 检查AI描述字段状态
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkAIDescriptions() {
  try {
    console.log('🔍 检查AI描述字段状态...\n');
    
    // 配置Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ 环境变量未正确配置');
      return;
    }
    
    console.log('✅ 环境变量配置正确');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 查询AI描述字段
    console.log('📊 查询AI描述字段状态...');
    const { data: records, error: queryError } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title, ai_description, age_orientation, text_type_fit')
      .limit(10);
    
    if (queryError) {
      console.log(`❌ 查询失败: ${queryError.message}`);
      return;
    }
    
    console.log(`✅ 查询成功，找到 ${records.length} 条记录\n`);
    
    // 分析AI描述内容
    console.log('📋 AI描述字段分析:');
    records.forEach((record, index) => {
      console.log(`\n${index + 1}. 📖 ${record.filename}`);
      console.log(`   书名: ${record.book_title}`);
      console.log(`   年龄定位: ${record.age_orientation}`);
      console.log(`   文本类型: ${record.text_type_fit}`);
      
      if (record.ai_description) {
        const description = record.ai_description;
        const isEnhanced = description.includes('主题') || 
                          description.includes('教育意义') || 
                          description.includes('价值观') ||
                          description.includes('适合') ||
                          description.includes('传递');
        
        console.log(`   AI描述: ${description.substring(0, 100)}...`);
        console.log(`   描述类型: ${isEnhanced ? '✅ 增强版' : '❌ 基础版'}`);
        
        if (isEnhanced) {
          console.log(`   ✅ 已包含绘本主旨信息`);
        } else {
          console.log(`   ❌ 缺少绘本主旨信息`);
        }
      } else {
        console.log(`   AI描述: 无`);
      }
    });
    
    // 统计增强版描述数量
    const enhancedCount = records.filter(record => {
      if (!record.ai_description) return false;
      return record.ai_description.includes('主题') || 
             record.ai_description.includes('教育意义') || 
             record.ai_description.includes('价值观') ||
             record.ai_description.includes('适合') ||
             record.ai_description.includes('传递');
    }).length;
    
    console.log(`\n📊 统计结果:`);
    console.log(`   总记录数: ${records.length}`);
    console.log(`   增强版描述: ${enhancedCount} 条`);
    console.log(`   基础版描述: ${records.length - enhancedCount} 条`);
    console.log(`   增强率: ${((enhancedCount / records.length) * 100).toFixed(1)}%`);
    
    if (enhancedCount === 0) {
      console.log('\n⚠️ 提示: 数据库中还没有增强版AI描述！');
      console.log('💡 建议运行增强版图片处理:');
      console.log('   npm run process-enhanced');
    } else if (enhancedCount < records.length) {
      console.log('\n⚠️ 提示: 部分记录还是基础版描述！');
      console.log('💡 建议运行增强版图片处理更新所有记录:');
      console.log('   npm run process-enhanced');
    } else {
      console.log('\n✅ 所有记录都已更新为增强版描述！');
    }
    
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
  }
}

checkAIDescriptions(); 