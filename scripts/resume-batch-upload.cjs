#!/usr/bin/env node

/**
 * 批量上传任务恢复脚本
 * 功能：
 * 1. 读取之前的处理报告
 * 2. 分析失败和未处理的文件
 * 3. 继续处理剩余文件
 * 4. 合并处理结果
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { batchUploadImages } = require('./batch-upload-enhanced');
require('dotenv').config({ path: '.env.local' });

// 读取最新的处理报告
function findLatestReport() {
  const reportDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportDir)) {
    throw new Error('未找到报告目录，请先运行批量上传脚本');
  }
  
  const reportFiles = fs.readdirSync(reportDir)
    .filter(file => file.startsWith('batch-upload-report-') && file.endsWith('.json'))
    .sort()
    .reverse();
  
  if (reportFiles.length === 0) {
    throw new Error('未找到任何处理报告');
  }
  
  const latestReportPath = path.join(reportDir, reportFiles[0]);
  const report = JSON.parse(fs.readFileSync(latestReportPath, 'utf8'));
  
  console.log(`📄 找到最新报告: ${reportFiles[0]}`);
  console.log(`   处理时间: ${new Date(report.startTime).toLocaleString()}`);
  console.log(`   成功: ${report.success}, 失败: ${report.failed}, 跳过: ${report.skipped}`);
  
  return report;
}

// 分析需要重新处理的文件
function analyzeFailedFiles(report, originalImageFolder) {
  const failedFiles = report.failedFiles || [];
  const processedFiles = report.processedFiles || [];
  
  console.log('\n📊 分析处理结果:');
  console.log(`   ✅ 已成功处理: ${processedFiles.length} 个文件`);
  console.log(`   ❌ 处理失败: ${failedFiles.length} 个文件`);
  
  // 获取原始文件夹中的所有图片
  const allImageFiles = fs.readdirSync(originalImageFolder)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    });
  
  // 找出未处理的文件
  const unprocessedFiles = allImageFiles.filter(file => 
    !processedFiles.includes(file) && 
    !failedFiles.some(f => f.filename === file)
  );
  
  console.log(`   ⏳ 未处理: ${unprocessedFiles.length} 个文件`);
  
  return {
    failedFiles: failedFiles.map(f => f.filename),
    unprocessedFiles,
    allNeedProcessing: [...failedFiles.map(f => f.filename), ...unprocessedFiles]
  };
}

// 创建临时文件夹包含需要处理的文件
function createTempProcessingFolder(originalFolder, filesToProcess) {
  const tempDir = path.join(process.cwd(), 'temp_resume_processing');
  
  // 清理并创建临时目录
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  console.log(`\n📁 创建临时处理目录: ${tempDir}`);
  
  // 复制需要处理的文件到临时目录
  let copiedCount = 0;
  filesToProcess.forEach(filename => {
    const sourcePath = path.join(originalFolder, filename);
    const targetPath = path.join(tempDir, filename);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
    } else {
      console.log(`   ⚠️ 文件不存在: ${filename}`);
    }
  });
  
  console.log(`   📋 复制了 ${copiedCount} 个文件待处理`);
  
  return tempDir;
}

// 清理临时文件夹
function cleanupTempFolder(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
    console.log(`🗑️ 清理临时目录: ${tempDir}`);
  }
}

// 检查数据库中的实际状态
async function checkDatabaseStatus(filesToCheck) {
  console.log('\n🔍 检查数据库中的实际状态...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  const actuallyProcessed = [];
  const needsProcessing = [];
  
  for (const filename of filesToCheck) {
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename')
      .eq('filename', filename)
      .single();
    
    if (data) {
      actuallyProcessed.push(filename);
    } else {
      needsProcessing.push(filename);
    }
  }
  
  console.log(`   ✅ 数据库中已存在: ${actuallyProcessed.length} 个文件`);
  console.log(`   🔄 需要处理: ${needsProcessing.length} 个文件`);
  
  if (actuallyProcessed.length > 0) {
    console.log('\n   已存在的文件:');
    actuallyProcessed.forEach(file => console.log(`     - ${file}`));
  }
  
  return needsProcessing;
}

// 主恢复函数
async function resumeBatchUpload(originalImageFolder, options = {}) {
  console.log('🔄 ===== 批量上传任务恢复 =====\n');
  
  try {
    // 1. 读取最新的处理报告
    const latestReport = findLatestReport();
    
    // 2. 分析失败的文件
    const analysis = analyzeFailedFiles(latestReport, originalImageFolder);
    
    if (analysis.allNeedProcessing.length === 0) {
      console.log('\n🎉 所有文件已处理完成，无需恢复！');
      return;
    }
    
    // 3. 检查数据库实际状态（可选）
    let finalFilesToProcess = analysis.allNeedProcessing;
    
    if (!options.skipDatabaseCheck) {
      finalFilesToProcess = await checkDatabaseStatus(analysis.allNeedProcessing);
      
      if (finalFilesToProcess.length === 0) {
        console.log('\n🎉 数据库检查显示所有文件已处理完成！');
        return;
      }
    }
    
    console.log(`\n📋 最终需要处理 ${finalFilesToProcess.length} 个文件`);
    
    // 4. 确认是否继续
    if (!options.autoConfirm) {
      console.log('\n❓ 是否继续处理这些文件？');
      console.log('   输入 "yes" 继续，或按 Ctrl+C 取消');
      
      // 简单的确认机制（在实际使用中可能需要更好的用户输入处理）
      await new Promise(resolve => {
        process.stdin.once('data', data => {
          const input = data.toString().trim().toLowerCase();
          if (input === 'yes' || input === 'y') {
            resolve(true);
          } else {
            console.log('❌ 用户取消操作');
            process.exit(0);
          }
        });
      });
    }
    
    // 5. 创建临时处理文件夹
    const tempDir = createTempProcessingFolder(originalImageFolder, finalFilesToProcess);
    
    try {
      // 6. 执行批量处理
      console.log('\n🚀 开始恢复处理...\n');
      await batchUploadImages(tempDir);
      
    } finally {
      // 7. 清理临时文件夹
      cleanupTempFolder(tempDir);
    }
    
    console.log('\n🎉 任务恢复完成！');
    
  } catch (error) {
    console.error('❌ 任务恢复失败:', error.message);
    process.exit(1);
  }
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('批量上传任务恢复工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/resume-batch-upload.js <原始图片文件夹路径> [选项]');
    console.log('');
    console.log('选项:');
    console.log('  --auto-confirm     自动确认，不询问用户');
    console.log('  --skip-db-check    跳过数据库状态检查');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/resume-batch-upload.js ./data/images');
    console.log('  node scripts/resume-batch-upload.js ./data/images --auto-confirm');
    process.exit(1);
  }
  
  const originalImageFolder = path.resolve(args[0]);
  const options = {
    autoConfirm: args.includes('--auto-confirm'),
    skipDatabaseCheck: args.includes('--skip-db-check')
  };
  
  if (!fs.existsSync(originalImageFolder)) {
    console.error(`❌ 图片文件夹不存在: ${originalImageFolder}`);
    process.exit(1);
  }
  
  resumeBatchUpload(originalImageFolder, options);
}

if (require.main === module) {
  main();
}

module.exports = { resumeBatchUpload }; 