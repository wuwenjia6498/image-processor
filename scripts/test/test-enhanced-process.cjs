#!/usr/bin/env node

// 测试增强版图片处理
const { processAllImagesEnhanced } = require('../src/process-all-images-enhanced.ts');

async function testEnhancedProcess() {
  try {
    console.log('🧪 测试增强版图片处理...\n');
    
    await processAllImagesEnhanced();
    
    console.log('\n✅ 增强版图片处理测试完成！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

testEnhancedProcess(); 