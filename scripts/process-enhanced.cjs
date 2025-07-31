#!/usr/bin/env node

const { processAllImagesEnhanced } = require('../src/process-all-images-enhanced.ts');

async function main() {
  try {
    console.log('🚀 启动增强版图片处理...\n');
    
    await processAllImagesEnhanced();
    
    console.log('\n🎉 增强版图片处理完成！');
    console.log('\n📋 新功能总结：');
    console.log('  ✅ 自动完成待标注字段（年龄定位、文本类型）');
    console.log('  ✅ 集成绘本主旨信息到AI描述');
    console.log('  ✅ 智能主题匹配和关键词提取');
    console.log('  ✅ 生成详细的处理报告');
    console.log('  ✅ 增强版CSV文件输出');
    
  } catch (error) {
    console.error('❌ 处理失败:', error);
    process.exit(1);
  }
}

main(); 