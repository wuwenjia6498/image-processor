#!/usr/bin/env node

/**
 * GPT-4V模型测试脚本
 * 功能：验证GPT-4V模型是否能正常进行图像分析
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
  baseURL: process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

// 测试GPT-4V图像分析
async function testGPT4Vision(imagePath) {
  console.log('🧪 ===== GPT-4V 模型测试 =====\n');
  
  try {
    // 检查图片文件是否存在
    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`);
    }
    
    const filename = path.basename(imagePath);
    console.log(`📸 测试图片: ${filename}`);
    console.log(`📁 文件路径: ${imagePath}`);
    
    // 读取并编码图片
    console.log('📖 读取图片文件...');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    
    console.log(`📊 图片大小: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`🖼️ MIME类型: ${mimeType}\n`);
    
    // 调用GPT-4V API
    console.log('🤖 调用GPT-4V进行图像分析...');
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // 使用最新的GPT-4o模型
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请用中文详细描述这张图片的内容，包括：1. 主要场景和内容 2. 人物或物体的特征 3. 色彩和艺术风格 4. 整体的情感氛围。请用一段话描述。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // 显示结果
    console.log('✅ GPT-4V 分析完成！\n');
    console.log('📝 AI描述结果:');
    console.log('─'.repeat(60));
    console.log(response.choices[0]?.message?.content || '未获取到描述');
    console.log('─'.repeat(60));
    console.log(`\n⏱️ 分析耗时: ${duration.toFixed(2)} 秒`);
    console.log(`📊 使用Token: ${response.usage?.total_tokens || 'N/A'}`);
    console.log(`🔧 模型版本: ${response.model || 'gpt-4-vision-preview'}`);
    
    console.log('\n🎉 GPT-4V 模型测试成功！');
    return response.choices[0]?.message?.content;
    
  } catch (error) {
    console.error('\n❌ GPT-4V 模型测试失败:');
    console.error(`   错误信息: ${error.message}`);
    
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    
    if (error.status) {
      console.error(`   HTTP状态: ${error.status}`);
    }
    
    // 如果是模型不可用错误，提供替代方案
    if (error.message.includes('model') || error.message.includes('vision')) {
      console.log('\n💡 可能的解决方案:');
      console.log('   1. 检查API密钥是否支持GPT-4V');
      console.log('   2. 尝试使用 gpt-4o 或 gpt-4o-mini 模型');
      console.log('   3. 确认账户有足够的API配额');
    }
    
    process.exit(1);
  }
}

// 命令行参数处理
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('GPT-4V 模型测试工具');
    console.log('');
    console.log('使用方法:');
    console.log('  node scripts/test-gpt4v.cjs <图片文件路径>');
    console.log('');
    console.log('示例:');
    console.log('  node scripts/test-gpt4v.cjs ./data/images/test.jpg');
    console.log('  node scripts/test-gpt4v.cjs /path/to/image.png');
    process.exit(1);
  }
  
  const imagePath = path.resolve(args[0]);
  testGPT4Vision(imagePath);
}

if (require.main === module) {
  main();
}

module.exports = { testGPT4Vision }; 