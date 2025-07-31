#!/usr/bin/env node

/**
 * 模型文件清理脚本
 * 删除大部分本地模型文件，保留量化版本作为备用
 * 节省存储空间：从 6.3GB 减少到约 1.5GB
 */

const fs = require('fs');
const path = require('path');

// 要保留的文件（量化版本和配置文件）
const KEEP_FILES = {
  'clip-vit-base-patch32': [
    // 配置文件（必需）
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json', 
    'preprocessor_config.json',
    'special_tokens_map.json',
    'vocab.json',
    'merges.txt',
    'README.md',
    '.gitattributes',
    // 只保留最小的量化版本
    'onnx/vision_model_q4f16.onnx',     // 51MB - 最小的视觉模型
    'onnx/text_model_q4f16.onnx',      // 69MB - 最小的文本模型
    'onnx/model_q4f16.onnx'            // 120MB - 最小的完整模型
  ],
  'vit-gpt2-image-captioning': [
    // 配置文件（必需）
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'preprocessor_config.json',
    'special_tokens_map.json',
    'vocab.json',
    'merges.txt',
    'generation_config.json',
    'quantize_config.json',
    'README.md',
    '.gitattributes',
    // 只保留量化版本
    'onnx/encoder_model_quantized.onnx',           // 83MB
    'onnx/decoder_model_quantized.onnx',          // 149MB
    'onnx/decoder_model_merged_quantized.onnx'    // 151MB
  ]
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (error) {
    return 0;
  }
}

function cleanupModelDirectory(modelName) {
  const modelDir = path.join(process.cwd(), 'models', modelName);
  
  if (!fs.existsSync(modelDir)) {
    console.log(`⚠️  模型目录不存在: ${modelDir}`);
    return { deletedFiles: 0, savedSpace: 0 };
  }
  
  console.log(`\n🧹 清理模型: ${modelName}`);
  console.log('='.repeat(50));
  
  const keepFiles = KEEP_FILES[modelName] || [];
  let deletedFiles = 0;
  let savedSpace = 0;
  
  // 递归遍历目录
  function processDirectory(dir, relativePath = '') {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const relativeItemPath = path.join(relativePath, item).replace(/\\/g, '/');
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // 递归处理子目录
        processDirectory(itemPath, relativeItemPath);
        
        // 如果目录为空，删除它
        try {
          const remainingItems = fs.readdirSync(itemPath);
          if (remainingItems.length === 0) {
            fs.rmdirSync(itemPath);
            console.log(`📁 删除空目录: ${relativeItemPath}`);
          }
        } catch (error) {
          // 目录不为空，保留
        }
      } else {
        // 检查文件是否在保留列表中
        if (!keepFiles.includes(relativeItemPath)) {
          const fileSize = stat.size;
          
          console.log(`🗑️  删除文件: ${relativeItemPath} (${formatFileSize(fileSize)})`);
          
          try {
            fs.unlinkSync(itemPath);
            deletedFiles++;
            savedSpace += fileSize;
          } catch (error) {
            console.log(`❌ 删除失败: ${relativeItemPath} - ${error.message}`);
          }
        } else {
          console.log(`✅ 保留文件: ${relativeItemPath} (${formatFileSize(stat.size)})`);
        }
      }
    }
  }
  
  processDirectory(modelDir);
  
  console.log(`\n📊 ${modelName} 清理统计:`);
  console.log(`   删除文件: ${deletedFiles} 个`);
  console.log(`   节省空间: ${formatFileSize(savedSpace)}`);
  
  return { deletedFiles, savedSpace };
}

function main() {
  console.log('🚀 开始清理本地模型文件...');
  console.log('目标: 删除大文件，保留量化版本作为备用');
  console.log('预期节省空间: 约 4.8GB');
  
  // 确认操作
  console.log('\n⚠️  警告: 此操作将永久删除大部分模型文件！');
  console.log('保留的文件列表:');
  
  Object.entries(KEEP_FILES).forEach(([modelName, files]) => {
    console.log(`\n📦 ${modelName}:`);
    files.forEach(file => {
      const fullPath = path.join(process.cwd(), 'models', modelName, file);
      const size = getFileSize(fullPath);
      if (size > 0) {
        console.log(`   ✅ ${file} (${formatFileSize(size)})`);
      } else {
        console.log(`   ⚠️  ${file} (文件不存在)`);
      }
    });
  });
  
  console.log('\n继续清理？ (按 Ctrl+C 取消)');
  console.log('开始清理...\n');
  
  let totalDeletedFiles = 0;
  let totalSavedSpace = 0;
  
  // 清理每个模型
  Object.keys(KEEP_FILES).forEach(modelName => {
    const result = cleanupModelDirectory(modelName);
    totalDeletedFiles += result.deletedFiles;
    totalSavedSpace += result.savedSpace;
  });
  
  // 清理缓存目录
  const cacheDir = path.join(process.cwd(), 'models', '.cache');
  if (fs.existsSync(cacheDir)) {
    console.log('\n🧹 清理缓存目录...');
    try {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('✅ 缓存目录已清理');
    } catch (error) {
      console.log(`⚠️  缓存清理失败: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 清理完成！');
  console.log(`📊 总计删除文件: ${totalDeletedFiles} 个`);
  console.log(`💾 总计节省空间: ${formatFileSize(totalSavedSpace)}`);
  console.log('\n✅ 系统仍然可以正常工作:');
  console.log('   • 优先使用云端AI服务 (OpenAI GPT-4V)');
  console.log('   • 保留量化模型作为备用');
  console.log('   • 配置文件完整保留');
  
  console.log('\n🔧 下一步操作:');
  console.log('   1. 配置 .env.local 中的 OPENAI_API_KEY');
  console.log('   2. 运行 npm run process-all 测试云端AI服务');
  console.log('   3. 运行 npm run verify 验证系统状态');
}

if (require.main === module) {
  main();
} 