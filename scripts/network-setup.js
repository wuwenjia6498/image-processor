#!/usr/bin/env node

import https from 'https';
import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

console.log('🔧 Hugging Face 网络问题诊断和解决工具');
console.log('=====================================\n');

// 测试网络连接
async function testConnection(url, name) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (res) => {
      console.log(`✅ ${name}: 连接成功 (状态码: ${res.statusCode})`);
      resolve(true);
    });
    
    request.on('error', (err) => {
      console.log(`❌ ${name}: 连接失败 - ${err.message}`);
      resolve(false);
    });
    
    request.setTimeout(10000, () => {
      console.log(`⏰ ${name}: 连接超时`);
      request.destroy();
      resolve(false);
    });
  });
}

// 检查环境变量
function checkEnvironmentVariables() {
  console.log('📋 检查环境变量配置...');
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env.local 文件不存在');
    console.log('💡 请复制 .env.local.example 为 .env.local 并配置相应变量');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasHfEndpoint = envContent.includes('HF_ENDPOINT');
  
  if (hasHfEndpoint) {
    console.log('✅ 检测到 HF_ENDPOINT 配置');
  } else {
    console.log('⚠️  未检测到 HF_ENDPOINT 配置');
    console.log('💡 建议在 .env.local 中添加: HF_ENDPOINT="https://hf-mirror.com"');
  }
  
  return true;
}

// 主要诊断流程
async function diagnoseNetwork() {
  console.log('🔍 开始网络连接诊断...\n');
  
  // 1. 检查环境变量
  checkEnvironmentVariables();
  console.log('');
  
  // 2. 测试各种连接
  console.log('🌐 测试网络连接...');
  const connections = [
    { url: 'https://huggingface.co', name: 'Hugging Face 官网' },
    { url: 'https://hf-mirror.com', name: 'HF-Mirror 镜像站' },
    { url: 'https://www.google.com', name: '谷歌 (测试国际网络)' },
    { url: 'https://www.baidu.com', name: '百度 (测试国内网络)' }
  ];
  
  const results = [];
  for (const conn of connections) {
    const success = await testConnection(conn.url, conn.name);
    results.push({ ...conn, success });
  }
  
  console.log('\n📊 连接测试结果汇总:');
  console.log('====================');
  
  const hfOfficial = results.find(r => r.name.includes('官网'));
  const hfMirror = results.find(r => r.name.includes('镜像站'));
  const international = results.find(r => r.name.includes('谷歌'));
  const domestic = results.find(r => r.name.includes('百度'));
  
  // 分析网络状况并给出建议
  if (hfOfficial.success) {
    console.log('🎉 网络状况良好！可以直接访问 Hugging Face');
    console.log('💡 建议: 可以不使用镜像，或保留镜像作为备选');
  } else if (hfMirror.success) {
    console.log('✅ 可以通过镜像站访问');
    console.log('💡 建议: 使用 HF-Mirror 镜像站');
    console.log('   在 .env.local 中设置: HF_ENDPOINT="https://hf-mirror.com"');
  } else if (international.success) {
    console.log('⚠️  可以访问国际网络，但 HF 相关站点被阻');
    console.log('💡 建议: 尝试其他镜像站或配置代理');
  } else if (domestic.success) {
    console.log('🔒 仅可访问国内网络');
    console.log('💡 建议: 配置代理服务器或使用离线模型');
  } else {
    console.log('❌ 网络连接异常');
    console.log('💡 建议: 检查网络连接和防火墙设置');
  }
  
  return results;
}

// 自动配置环境变量
function autoConfigureEnvironment(results) {
  console.log('\n⚙️  自动配置环境变量...');
  
  const envPath = path.join(process.cwd(), '.env.local');
  const envExamplePath = path.join(process.cwd(), '.env.local.example');
  
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  } else if (fs.existsSync(envExamplePath)) {
    envContent = fs.readFileSync(envExamplePath, 'utf8');
    console.log('📋 从 .env.local.example 复制配置');
  }
  
  // 根据网络测试结果选择最佳配置
  const hfMirror = results.find(r => r.name.includes('镜像站'));
  
  if (hfMirror && hfMirror.success) {
    if (!envContent.includes('HF_ENDPOINT=')) {
      envContent += '\n# Hugging Face 镜像配置\nHF_ENDPOINT="https://hf-mirror.com"\n';
    } else {
      envContent = envContent.replace(
        /HF_ENDPOINT=.*/,
        'HF_ENDPOINT="https://hf-mirror.com"'
      );
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ 已配置 HF-Mirror 镜像');
  }
}

// 提供解决方案
function provideSolutions(results) {
  console.log('\n🛠️  网络问题解决方案:');
  console.log('=====================');
  
  console.log('\n方案1: 使用镜像站 (推荐)');
  console.log('  1. 在 .env.local 中添加: HF_ENDPOINT="https://hf-mirror.com"');
  console.log('  2. 重新运行程序');
  
  console.log('\n方案2: 配置代理服务器');
  console.log('  1. 在 .env.local 中添加:');
  console.log('     HTTP_PROXY="http://your-proxy:port"');
  console.log('     HTTPS_PROXY="http://your-proxy:port"');
  console.log('  2. 重新运行程序');
  
  console.log('\n方案3: 预下载模型到本地');
  console.log('  1. 使用 huggingface-cli 预下载:');
  console.log('     npm install -g @huggingface/hub');
  console.log('     huggingface-cli download Xenova/vit-gpt2-image-captioning');
  console.log('     huggingface-cli download Xenova/clip-ViT-B-32');
  
  console.log('\n方案4: 使用专用下载工具');
  console.log('  1. 使用 hfd 工具进行多线程下载');
  console.log('  2. 参考: https://hf-mirror.com/');
  
  console.log('\n💡 如果以上方案都无效，可以考虑:');
  console.log('   - 使用 VPN 服务');
  console.log('   - 联系网络管理员');
  console.log('   - 使用移动热点测试');
}

// 主函数
async function main() {
  try {
    const results = await diagnoseNetwork();
    autoConfigureEnvironment(results);
    provideSolutions(results);
    
    console.log('\n🎯 诊断完成！');
    console.log('如果问题仍然存在，请查看上述解决方案或联系技术支持。');
    
  } catch (error) {
    console.error('❌ 诊断过程中出现错误:', error.message);
  }
}

// 运行诊断
main(); 