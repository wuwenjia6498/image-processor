#!/usr/bin/env node

/**
 * 批量上传快速开始脚本
 * 功能：
 * 1. 检查环境配置
 * 2. 验证依赖和连接
 * 3. 提供使用指导
 * 4. 快速启动批量上传
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: '.env.local' });

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 检查环境变量
function checkEnvironmentVariables() {
  console.log('\n🔧 检查环境变量配置...\n');
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 
    'VITE_OPENAI_API_KEY',
    'VITE_PINECONE_API_KEY',
    'VITE_PINECONE_INDEX_NAME'
  ];

  const missingVars = [];
  const presentVars = [];

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      presentVars.push(varName);
      const value = process.env[varName];
      const displayValue = value.length > 20 ? 
        value.substring(0, 10) + '...' + value.substring(value.length - 6) : 
        value;
      colorLog('green', `✅ ${varName}: ${displayValue}`);
    } else {
      missingVars.push(varName);
      colorLog('red', `❌ ${varName}: 未设置`);
    }
  });

  return { missingVars, presentVars };
}

// 测试Supabase连接
async function testSupabaseConnection() {
  console.log('\n🗄️ 测试Supabase数据库连接...\n');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 测试连接
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('count', { count: 'exact', head: true });

    if (error) {
      colorLog('red', `❌ 数据库连接失败: ${error.message}`);
      return false;
    }

    colorLog('green', `✅ Supabase连接成功`);
    colorLog('blue', `📊 当前数据库记录数: ${data || 0}`);
    return true;

  } catch (error) {
    colorLog('red', `❌ Supabase连接异常: ${error.message}`);
    return false;
  }
}

// 检查依赖包
function checkDependencies() {
  console.log('\n📦 检查项目依赖...\n');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    colorLog('red', '❌ 未找到package.json文件');
    return false;
  }

  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    colorLog('red', '❌ 未找到node_modules，请运行: npm install');
    return false;
  }

  // 检查关键依赖
  const criticalDeps = [
    '@supabase/supabase-js',
    '@pinecone-database/pinecone', 
    'openai',
    'dotenv'
  ];

  let allDepsPresent = true;
  criticalDeps.forEach(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    if (fs.existsSync(depPath)) {
      colorLog('green', `✅ ${dep}`);
    } else {
      colorLog('red', `❌ ${dep} 未安装`);
      allDepsPresent = false;
    }
  });

  return allDepsPresent;
}

// 创建示例目录结构
function createExampleStructure() {
  console.log('\n📁 创建示例目录结构...\n');
  
  const dirs = ['data/images', 'reports', 'temp_resume_processing'];
  
  dirs.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      colorLog('green', `✅ 创建目录: ${dir}`);
    } else {
      colorLog('blue', `📁 目录已存在: ${dir}`);
    }
  });
}

// 显示使用指南
function showUsageGuide() {
  console.log('\n' + '='.repeat(60));
  colorLog('cyan', '🖼️  批量图片上传系统 - 快速开始指南');
  console.log('='.repeat(60));
  
  console.log('\n📋 基本使用步骤:\n');
  
  console.log('1️⃣  将图片放入目标文件夹');
  colorLog('yellow', '   例如: ./data/images/ 或 /path/to/your/images/');
  
  console.log('\n2️⃣  启动批量上传');
  colorLog('green', '   npm run batch-upload-enhanced ./data/images');
  
  console.log('\n3️⃣  监控处理进度 (可选，在新终端窗口)');
  colorLog('green', '   npm run monitor-upload');
  
  console.log('\n4️⃣  如需恢复失败任务');
  colorLog('green', '   npm run resume-upload ./data/images');
  
  console.log('\n📊 支持的文件格式:');
  colorLog('blue', '   .jpg, .jpeg, .png, .gif, .bmp, .webp');
  
  console.log('\n⚙️  配置参数:');
  console.log('   • 批处理大小: 10张/批次');
  console.log('   • 最大重试: 3次');
  console.log('   • 最大文件: 10MB');
  console.log('   • AI模型: GPT-4o (具有视觉分析能力)');
  console.log('   • 向量模型: text-embedding-3-small (1536维)');
  
  console.log('\n📄 处理报告位置:');
  colorLog('blue', '   ./reports/batch-upload-report-*.json');
  colorLog('blue', '   ./reports/batch-upload-report-*.txt');
  
  console.log('\n' + '='.repeat(60));
}

// 交互式启动
async function interactiveStart() {
  console.log('\n🚀 是否立即开始批量上传？');
  console.log('\n选项:');
  console.log('  1 - 上传 ./data/images 文件夹');
  console.log('  2 - 指定其他文件夹');
  console.log('  3 - 启动监控面板');
  console.log('  4 - 查看帮助文档');
  console.log('  q - 退出');
  
  process.stdin.setEncoding('utf8');
  console.log('\n请选择 (1-4, q): ');
  
  return new Promise((resolve) => {
    process.stdin.once('data', async (data) => {
      const choice = data.toString().trim();
      
      switch (choice) {
        case '1':
          const defaultPath = path.join(process.cwd(), 'data', 'images');
          if (fs.existsSync(defaultPath)) {
            const files = fs.readdirSync(defaultPath).filter(f => 
              /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(f)
            );
            
            if (files.length > 0) {
              colorLog('green', `\n🎯 找到 ${files.length} 张图片，开始处理...`);
              startBatchUpload(defaultPath);
            } else {
              colorLog('yellow', '\n⚠️ ./data/images 文件夹为空，请添加图片文件');
            }
          } else {
            colorLog('red', '\n❌ ./data/images 文件夹不存在');
          }
          resolve();
          break;
          
        case '2':
          console.log('\n请输入图片文件夹路径: ');
          process.stdin.once('data', (pathData) => {
            const customPath = pathData.toString().trim();
            if (fs.existsSync(customPath)) {
              startBatchUpload(customPath);
            } else {
              colorLog('red', `❌ 路径不存在: ${customPath}`);
            }
            resolve();
          });
          break;
          
        case '3':
          colorLog('green', '\n🖥️ 启动监控面板...');
          startMonitoring();
          resolve();
          break;
          
        case '4':
          colorLog('blue', '\n📖 打开帮助文档...');
          console.log('\n请查看: ./docs/BATCH_UPLOAD_GUIDE.md');
          resolve();
          break;
          
        case 'q':
          colorLog('yellow', '\n👋 退出快速开始向导');
          resolve();
          break;
          
        default:
          colorLog('red', '\n❌ 无效选择，请重新运行脚本');
          resolve();
          break;
      }
    });
  });
}

// 启动批量上传
function startBatchUpload(imagePath) {
  const child = spawn('node', ['scripts/batch-upload-enhanced.js', imagePath], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('close', (code) => {
    if (code === 0) {
      colorLog('green', '\n🎉 批量上传完成！');
    } else {
      colorLog('red', `\n❌ 批量上传失败，退出码: ${code}`);
    }
  });
}

// 启动监控
function startMonitoring() {
  const child = spawn('node', ['scripts/monitor-batch-progress.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('close', (code) => {
    colorLog('blue', '\n📊 监控已结束');
  });
}

// 主函数
async function main() {
  colorLog('cyan', '🖼️  批量图片上传系统 - 快速开始向导');
  colorLog('cyan', '='.repeat(50));
  
  // 1. 检查环境变量
  const { missingVars } = checkEnvironmentVariables();
  
  if (missingVars.length > 0) {
    colorLog('red', '\n❌ 环境配置不完整，请检查 .env.local 文件');
    colorLog('yellow', '\n💡 参考 .env.local.example 文件配置');
    process.exit(1);
  }
  
  // 2. 检查依赖
  const depsOk = checkDependencies();
  if (!depsOk) {
    colorLog('red', '\n❌ 依赖检查失败，请运行: npm install');
    process.exit(1);
  }
  
  // 3. 测试数据库连接
  const dbOk = await testSupabaseConnection();
  if (!dbOk) {
    colorLog('red', '\n❌ 数据库连接失败，请检查配置');
    process.exit(1);
  }
  
  // 4. 创建目录结构
  createExampleStructure();
  
  // 5. 显示使用指南
  showUsageGuide();
  
  // 6. 交互式启动
  await interactiveStart();
}

// 命令行参数处理
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('批量上传快速开始向导');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/quick-start.js');
    console.log('');
    console.log('功能:');
    console.log('  • 检查环境配置');
    console.log('  • 验证依赖和连接');
    console.log('  • 提供交互式启动选项');
    console.log('  • 快速开始批量上传');
    process.exit(0);
  }
  
  main().catch(error => {
    colorLog('red', `❌ 快速开始失败: ${error.message}`);
    process.exit(1);
  });
} 