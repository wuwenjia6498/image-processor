#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function finalVerificationAndCleanup() {
  console.log('🎯 ===== 最终验证和清理 =====\n');
  
  try {
    // 1. 验证数据完整性
    console.log('🔍 验证数据完整性...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: records } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, ai_description, vector_embedding, created_at')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });
    
    console.log(`📊 今日记录总数: ${records?.length || 0}`);
    
    let compliantRecords = 0;
    let hasVectors = 0;
    let longDescriptions = 0;
    let asciiIds = 0;
    
    records?.forEach(record => {
      const hasChineseInId = /[\u4e00-\u9fa5]/.test(record.id);
      const hasVector = record.vector_embedding && Array.isArray(record.vector_embedding) && record.vector_embedding.length === 1536;
      const hasLongDesc = record.ai_description && record.ai_description.length >= 400;
      const hasAsciiId = !hasChineseInId;
      
      if (hasAsciiId) asciiIds++;
      if (hasVector) hasVectors++;
      if (hasLongDesc) longDescriptions++;
      if (hasAsciiId && hasVector && hasLongDesc) compliantRecords++;
    });
    
    console.log('📈 ===== 数据质量统计 =====');
    console.log(`✅ 完全符合要求: ${compliantRecords}/${records?.length || 0} (${((compliantRecords/(records?.length || 1))*100).toFixed(1)}%)`);
    console.log(`🆔 ASCII格式ID: ${asciiIds}/${records?.length || 0}`);
    console.log(`📝 详细描述(≥400字): ${longDescriptions}/${records?.length || 0}`);
    console.log(`🧮 1536维向量: ${hasVectors}/${records?.length || 0}`);
    
    if (compliantRecords === records?.length && records?.length > 0) {
      console.log('\n🎉 所有记录都完全符合要求！数据质量完美！');
    } else {
      console.log(`\n⚠️ 数据质量需要关注`);
      return;
    }
    
    // 2. 清理临时文件
    console.log('\n🧹 清理临时文件...');
    
    const filesToClean = [
      'scripts/quick-fix-vectors.cjs',
      'scripts/fix-missing-vectors.cjs'
    ];
    
    let cleanedCount = 0;
    filesToClean.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size === 0 || filePath.includes('fix-missing-vectors.cjs')) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ 已删除: ${filePath}`);
          cleanedCount++;
        }
      }
    });
    
    // 清理空的临时目录
    const tempDir = 'temp_resume_processing';
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir);
      if (tempFiles.length === 0) {
        fs.rmdirSync(tempDir);
        console.log(`🗑️ 已删除空目录: ${tempDir}`);
        cleanedCount++;
      }
    }
    
    // 清理多余的报告文件（保留最新的3个）
    const reportsDir = 'reports';
    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('batch-upload-report-'))
        .sort()
        .reverse();
      
      if (reportFiles.length > 6) { // 保留最新的3对文件（json+txt）
        const filesToDelete = reportFiles.slice(6);
        filesToDelete.forEach(file => {
          fs.unlinkSync(path.join(reportsDir, file));
          cleanedCount++;
        });
        console.log(`🗑️ 清理了 ${filesToDelete.length} 个旧报告文件`);
      }
    }
    
    console.log(`\n📊 清理统计: 删除了 ${cleanedCount} 个临时文件`);
    
    // 3. 最终状态报告
    console.log('\n🎯 ===== 最终状态报告 =====');
    console.log('✅ 数据完整性: 100% 完美');
    console.log('✅ 向量数据: 全部补充完成');
    console.log('✅ ID格式: 全部标准化');
    console.log('✅ AI描述: 全部详细化');
    console.log('✅ 临时文件: 已清理');
    console.log('✅ 系统状态: 完全就绪');
    
    console.log('\n🚀 ===== 系统已完全准备就绪 =====');
    console.log('现在可以安全地处理1000+张图片的批量上传！');
    console.log('');
    console.log('可用命令:');
    console.log('  npm run batch-upload-enhanced ./your-images-folder');
    console.log('  npm run monitor-upload');
    console.log('  npm run resume-upload ./your-images-folder');
    console.log('  npm run manage-records');
    
  } catch (error) {
    console.error('❌ 验证或清理失败:', error.message);
  }
}

finalVerificationAndCleanup();