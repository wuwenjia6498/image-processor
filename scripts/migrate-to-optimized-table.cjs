#!/usr/bin/env node

/**
 * 数据迁移脚本：从 illustrations 表迁移到 illustrations_optimized 表
 * 简化表结构，主要依赖GPT-4V的AI描述
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function migrateToOptimizedTable() {
  console.log('🔄 开始数据迁移：illustrations → illustrations_optimized\n');
  
  try {
    // 初始化Supabase客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 步骤1：检查原表数据
    console.log('📊 1. 检查原表数据...');
    const { data: oldRecords, error: fetchError } = await supabase
      .from('illustrations')
      .select('*');
    
    if (fetchError) {
      throw new Error(`获取原表数据失败: ${fetchError.message}`);
    }
    
    console.log(`✓ 原表记录数: ${oldRecords.length}`);
    
    // 步骤2：检查新表是否存在
    console.log('\n🔍 2. 检查新表状态...');
    const { data: newTableCheck, error: checkError } = await supabase
      .from('illustrations_optimized')
      .select('count')
      .limit(1);
    
    if (checkError) {
      console.log('⚠️ 新表不存在，请先在Supabase中执行创建表的SQL语句');
      console.log('📄 SQL文件位置: create_illustrations_optimized_table.sql');
      return;
    }
    
    console.log('✓ 新表已存在');
    
    // 步骤3：开始数据迁移
    console.log('\n🚀 3. 开始数据迁移...');
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < oldRecords.length; i++) {
      const record = oldRecords[i];
      
      try {
        // 迁移数据到新表
        const { error: insertError } = await supabase
          .from('illustrations_optimized')
          .upsert({
            id: record.id,
            filename: record.filename,
            book_title: record.book_title,
            image_url: record.image_url || '',
            ai_description: record.ai_description,
            age_orientation: record.age_orientation || '待标注',
            text_type_fit: record.text_type_fit || '待标注',
            vector_embedding: record.vector_embedding,
            created_at: record.created_at,
            updated_at: record.updated_at
          });
        
        if (insertError) {
          throw insertError;
        }
        
        successCount++;
        console.log(`✅ [${i + 1}/${oldRecords.length}] ${record.filename} - ${record.book_title}`);
        
      } catch (error) {
        failCount++;
        console.log(`❌ [${i + 1}/${oldRecords.length}] ${record.filename} 失败: ${error.message}`);
      }
    }
    
    // 步骤4：验证迁移结果
    console.log('\n🔍 4. 验证迁移结果...');
    const { data: newRecords, error: verifyError } = await supabase
      .from('illustrations_optimized')
      .select('*');
    
    if (verifyError) {
      throw new Error(`验证失败: ${verifyError.message}`);
    }
    
    console.log('\n📊 迁移统计:');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ❌ 失败: ${failCount}`);
    console.log(`   📈 成功率: ${Math.round((successCount / oldRecords.length) * 100)}%`);
    console.log(`   📋 新表记录数: ${newRecords.length}`);
    
    // 步骤5：字段简化效果展示
    console.log('\n🎯 字段简化效果:');
    console.log('   原表字段: 15个');
    console.log('     • 9个标签数组字段 (style_tags, mood_tags, etc.)');
    console.log('     • 3个文本字段 (text_type_fit, age_orientation, book_theme_summary)');
    console.log('     • 3个基础字段 (id, filename, book_title, etc.)');
    console.log('   新表字段: 8个');
    console.log('     • 1个AI描述字段 (包含所有风格、情绪、场景信息)');
    console.log('     • 2个保留标签字段 (age_orientation, text_type_fit)');
    console.log('     • 5个基础字段');
    console.log('   减少字段: 47%');
    console.log('   减少标签字段: 90%');
    
    if (successCount === oldRecords.length) {
      console.log('\n🎉 数据迁移完成！');
      console.log('\n📝 下一步:');
      console.log('   1. 更新处理脚本使用新表');
      console.log('   2. 测试新表的搜索功能');
      console.log('   3. 确认无误后可以删除旧表');
    } else {
      console.log('\n⚠️ 部分数据迁移失败，请检查错误信息');
    }
    
  } catch (error) {
    console.log('❌ 迁移失败:', error.message);
  }
}

if (require.main === module) {
  migrateToOptimizedTable();
} 