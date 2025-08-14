#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少Supabase配置信息');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateFinalSummary() {
  console.log('📋 生成最终批量上传总结报告...\n');
  
  try {
    // 1. 统计数据库记录
    const { count: totalRecords, error: countError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('❌ 查询记录数失败:', countError);
      return;
    }
    
    // 2. 统计原始图片文件数量
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file));
    
    // 3. 查询今天添加的记录
    const today = new Date().toISOString().split('T')[0];
    const { data: todayRecords, error: todayError } = await supabase
      .from('illustrations_optimized')
      .select('filename, book_title, created_at')
      .gte('created_at', today + 'T00:00:00')
      .order('created_at', { ascending: false });
      
    // 4. 分析报告文件
    const reportsDir = path.join(process.cwd(), 'reports');
    const reportFiles = fs.readdirSync(reportsDir)
      .filter(file => file.endsWith('.txt'))
      .sort()
      .reverse(); // 最新的在前
    
    console.log('🎯 批量上传最终结果总结');
    console.log('================================');
    console.log(`📁 原始图片文件总数: ${imageFiles.length}`);
    console.log(`💾 数据库中记录总数: ${totalRecords}`);
    console.log(`📈 今日新增记录数: ${todayRecords ? todayRecords.length : 0}`);
    console.log(`📊 总体完成率: ${((totalRecords / imageFiles.length) * 100).toFixed(1)}%`);
    
    if (todayRecords && todayRecords.length > 0) {
      console.log('\n📝 今日处理的最新记录:');
      todayRecords.slice(0, 10).forEach((record, index) => {
        const time = new Date(record.created_at).toLocaleString('zh-CN');
        console.log(`  ${index + 1}. ${record.filename} (${record.book_title}) - ${time}`);
      });
      
      if (todayRecords.length > 10) {
        console.log(`  ... 以及其他 ${todayRecords.length - 10} 条记录`);
      }
    }
    
    console.log('\n📄 处理报告文件:');
    reportFiles.slice(0, 3).forEach(file => {
      console.log(`  - ${file}`);
    });
    
    // 5. 检查未处理的文件
    const { data: processedFiles, error: processedError } = await supabase
      .from('illustrations_optimized')
      .select('filename');
      
    if (!processedError && processedFiles) {
      const processedFilenames = new Set(processedFiles.map(r => r.filename));
      const unprocessedFiles = imageFiles.filter(file => !processedFilenames.has(file));
      
      if (unprocessedFiles.length > 0) {
        console.log(`\n⚠️ 尚未处理的文件 (${unprocessedFiles.length}个):`);
        unprocessedFiles.slice(0, 10).forEach(file => {
          console.log(`  - ${file}`);
        });
        if (unprocessedFiles.length > 10) {
          console.log(`  ... 以及其他 ${unprocessedFiles.length - 10} 个文件`);
        }
      } else {
        console.log('\n✅ 所有图片文件都已处理完成！');
      }
    }
    
    console.log('\n🎉 批量上传第一阶段已完成！');
    console.log('💡 下一步: 运行 Python 脚本进行第二阶段处理');
    console.log('   命令: python process_illustrations_data.py');
    
  } catch (error) {
    console.error('❌ 生成总结报告时出错:', error);
  }
}

generateFinalSummary();
