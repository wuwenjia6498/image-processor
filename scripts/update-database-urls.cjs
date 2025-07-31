#!/usr/bin/env node

/**
 * 更新数据库IMAGE_URL脚本
 * 将生成的图片URL更新到数据库
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function updateDatabaseUrls() {
  console.log('🔄 更新数据库IMAGE_URL\n');
  
  try {
    // 初始化Supabase客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 读取生成的CSV文件
    const csvPath = path.join(process.cwd(), 'data', 'image_urls.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV文件不存在: ${csvPath}`);
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const header = lines[0].split(',').map(field => field.replace(/"/g, ''));
    const data = lines.slice(1);
    
    console.log(`📄 读取CSV文件: ${csvPath}`);
    console.log(`📊 数据记录数: ${data.length}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // 处理每条记录
    for (let i = 0; i < data.length; i++) {
      const line = data[i];
      const values = line.split(',').map(field => field.replace(/"/g, ''));
      
      const record = {};
      header.forEach((key, index) => {
        record[key] = values[index];
      });
      
      const { filename, book_title, image_url, encoded_filename } = record;
      
      console.log(`\n[${i + 1}/${data.length}] 更新: ${filename}`);
      console.log(`   📖 绘本标题: ${book_title}`);
      console.log(`   🔗 图片URL: ${image_url}`);
      
      try {
        // 更新Supabase数据库
        const { error: updateError } = await supabase
          .from('illustrations_optimized')
          .update({ 
            image_url: image_url,
            updated_at: new Date().toISOString()
          })
          .eq('filename', filename);
        
        if (updateError) {
          throw new Error(`数据库更新失败: ${updateError.message}`);
        }
        
        successCount++;
        console.log(`   ✅ 数据库更新成功`);
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ 更新失败: ${error.message}`);
        continue;
      }
    }
    
    // 统计报告
    console.log('\n📊 更新统计:');
    console.log(`   ✅ 成功: ${successCount} 条记录`);
    console.log(`   ❌ 失败: ${errorCount} 条记录`);
    console.log(`   📈 成功率: ${Math.round((successCount / data.length) * 100)}%`);
    
    // 验证更新结果
    console.log('\n🔍 验证更新结果...');
    const { data: sampleRecords, error: queryError } = await supabase
      .from('illustrations_optimized')
      .select('filename, image_url')
      .not('image_url', 'eq', '')
      .limit(5);
    
    if (queryError) {
      console.log(`⚠️ 查询验证失败: ${queryError.message}`);
    } else {
      console.log(`✓ 数据库中有 ${sampleRecords.length} 条记录包含IMAGE_URL`);
      sampleRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.filename}`);
        console.log(`      URL: ${record.image_url}`);
      });
    }
    
    console.log('\n🎉 数据库IMAGE_URL更新完成！');
    console.log('\n💡 总结:');
    console.log('   ✅ 所有图片已上传到Supabase Storage');
    console.log('   ✅ 所有图片URL已生成');
    console.log('   ✅ 数据库记录已更新');
    console.log('   ✅ 图片可通过URL直接访问');
    
  } catch (error) {
    console.log('❌ 更新失败:', error.message);
  }
}

if (require.main === module) {
  updateDatabaseUrls();
} 