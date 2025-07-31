#!/usr/bin/env node

/**
 * 调试优化处理脚本
 * 诊断process-optimized脚本的问题
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function debugProcessOptimized() {
  console.log('🔍 调试优化处理脚本\n');
  
  try {
    // 1. 检查环境变量
    console.log('🔧 1. 检查环境变量...');
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PINECONE_API_KEY',
      'PINECONE_INDEX_NAME'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.log(`❌ 缺少环境变量: ${missingVars.join(', ')}`);
      return;
    }
    
    console.log('✅ 所有必需的环境变量都存在');
    
    // 2. 检查图片目录
    console.log('\n📁 2. 检查图片目录...');
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    if (!fs.existsSync(imagesDir)) {
      console.log(`❌ 图片目录不存在: ${imagesDir}`);
      return;
    }
    
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file))
      .sort();
    
    console.log(`✅ 找到 ${imageFiles.length} 张图片`);
    console.log(`   前5张: ${imageFiles.slice(0, 5).join(', ')}`);
    
    // 3. 检查TypeScript文件
    console.log('\n📄 3. 检查TypeScript文件...');
    const tsFile = path.join(process.cwd(), 'src', 'process-all-images-optimized.ts');
    if (!fs.existsSync(tsFile)) {
      console.log(`❌ TypeScript文件不存在: ${tsFile}`);
      return;
    }
    
    console.log('✅ TypeScript文件存在');
    
    // 4. 检查依赖
    console.log('\n📦 4. 检查依赖...');
    const packageJson = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJson)) {
      console.log('❌ package.json不存在');
      return;
    }
    
    const packageData = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    const requiredDeps = ['@supabase/supabase-js', '@pinecone-database/pinecone', 'openai'];
    
    const missingDeps = requiredDeps.filter(dep => !packageData.dependencies[dep]);
    if (missingDeps.length > 0) {
      console.log(`❌ 缺少依赖: ${missingDeps.join(', ')}`);
      return;
    }
    
    console.log('✅ 所有必需的依赖都存在');
    
    // 5. 检查tsx是否安装
    console.log('\n⚡ 5. 检查tsx...');
    const tsxPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');
    if (!fs.existsSync(tsxPath)) {
      console.log('❌ tsx未安装，请运行: npm install');
      return;
    }
    
    console.log('✅ tsx已安装');
    
    // 6. 尝试直接运行tsx
    console.log('\n🚀 6. 尝试直接运行tsx...');
    const { execSync } = require('child_process');
    
    try {
      const result = execSync('npx tsx --version', { encoding: 'utf8' });
      console.log(`✅ tsx版本: ${result.trim()}`);
    } catch (error) {
      console.log(`❌ tsx运行失败: ${error.message}`);
      return;
    }
    
    // 7. 尝试导入模块
    console.log('\n📥 7. 尝试导入模块...');
    try {
      const { createClient } = require('@supabase/supabase-js');
      console.log('✅ @supabase/supabase-js 导入成功');
      
      const { Pinecone } = require('@pinecone-database/pinecone');
      console.log('✅ @pinecone-database/pinecone 导入成功');
      
      const OpenAI = require('openai');
      console.log('✅ openai 导入成功');
      
    } catch (error) {
      console.log(`❌ 模块导入失败: ${error.message}`);
    }
    
    console.log('\n🎯 调试完成！');
    console.log('\n💡 建议:');
    console.log('   1. 确保所有依赖已安装: npm install');
    console.log('   2. 检查TypeScript语法: npx tsc --noEmit');
    console.log('   3. 尝试直接运行: npx tsx src/process-all-images-optimized.ts');
    
  } catch (error) {
    console.log('❌ 调试失败:', error.message);
  }
}

if (require.main === module) {
  debugProcessOptimized();
} 