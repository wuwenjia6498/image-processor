/**
 * 快速前端网络搜索功能测试
 * 简单直接，避免复杂的异步处理问题
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

async function quickTest() {
  console.log('🧪 ===== 快速前端搜索功能测试 =====\n');
  
  // 检查环境变量
  const apiKey = process.env.VITE_OPENAI_API_KEY;
  console.log('🔑 API密钥状态:', apiKey ? '✅ 已配置' : '❌ 未配置');
  
  if (apiKey) {
    console.log('🔑 API密钥预览:', `${apiKey.substring(0, 7)}...${apiKey.substring(-4)}`);
  }
  
  if (!apiKey) {
    console.log('\n❌ 错误: 请先配置 VITE_OPENAI_API_KEY 环境变量');
    console.log('📝 在 .env.local 文件中添加:');
    console.log('   VITE_OPENAI_API_KEY=sk-your-openai-key-here\n');
    return;
  }

  try {
    console.log('📚 正在导入前端AI服务...');
    const { generateImageDescription } = await import('../services/frontend-ai-service');
    console.log('✅ 导入成功\n');

    // 简单测试一个绘本
    const testBook = '三只小猪';
    console.log(`📖 测试绘本：《${testBook}》`);
    console.log('=' .repeat(40));

    // 创建一个最小的测试图片（1x1像素的JPEG）
    const minimalImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    console.log('🔄 开始测试网络搜索功能...');
    const startTime = Date.now();

    // 设置超时保护
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('测试超时 (30秒)')), 30000);
    });

    const testPromise = generateImageDescription(minimalImage, testBook);

    const result = await Promise.race([testPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    console.log(`✅ 测试成功完成！耗时: ${duration}ms`);
    console.log(`📝 描述长度: ${result.length} 字符`);
    console.log(`📋 描述预览: ${result.substring(0, 150)}...`);
    console.log('\n🎉 前端网络搜索功能正常工作！');

  } catch (error) {
    console.log(`❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    console.log('\n💡 可能的解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 验证 OpenAI API 密钥是否有效');
    console.log('3. 确认 API 密钥有足够的配额');
  }
}

// 运行测试
quickTest().catch(console.error);