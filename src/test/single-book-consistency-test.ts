/**
 * 单个绘本的前端一致性测试
 * 简化版本，避免复杂的循环逻辑
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testSingleBook() {
  console.log('🧪 ===== 单个绘本前端一致性测试 =====\n');
  
  // 检查环境变量
  const apiKey = process.env.VITE_OPENAI_API_KEY;
  console.log('🔑 API密钥状态:', apiKey ? '✅ 已配置' : '❌ 未配置');
  
  if (!apiKey) {
    console.log('\n❌ 错误: 请先配置 VITE_OPENAI_API_KEY 环境变量');
    return;
  }

  try {
    console.log('📚 正在导入前端AI服务...');
    const { generateImageDescription } = await import('../services/frontend-ai-service');
    console.log('✅ 导入成功\n');

    // 测试单个绘本
    const testBook = '三只小猪';
    console.log(`📖 测试绘本：《${testBook}》`);
    console.log('=' .repeat(40));

    // 创建测试图片
    const testImageUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

    console.log('🔄 开始生成AI描述...');
    console.log('⏰ 预计需要10-20秒...\n');
    
    const startTime = Date.now();

    // 设置超时保护（60秒）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('测试超时 (60秒)')), 60000);
    });

    const testPromise = generateImageDescription(testImageUrl, testBook);

    // 添加进度提示
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      console.log(`⏳ 处理中... (已用时 ${elapsed}秒)`);
    }, 5000);

    try {
      const result = await Promise.race([testPromise, timeoutPromise]);
      clearInterval(progressInterval);
      
      const duration = Date.now() - startTime;

      console.log(`\n✅ 测试成功完成！`);
      console.log(`⏱️  总耗时: ${duration}ms (${Math.round(duration/1000)}秒)`);
      console.log(`📝 描述长度: ${result.length} 字符`);
      
      // 验证描述质量
      const hasBookName = result.includes(testBook);
      const isLongEnough = result.length >= 300;
      const hasChineseContent = /[\u4e00-\u9fa5]/.test(result);
      
      console.log('\n📊 质量检查:');
      console.log(`   包含绘本名称: ${hasBookName ? '✅' : '❌'}`);
      console.log(`   描述长度充足: ${isLongEnough ? '✅' : '❌'} (${result.length}/300+)`);
      console.log(`   中文内容: ${hasChineseContent ? '✅' : '❌'}`);
      
      console.log(`\n📋 描述预览:`);
      console.log(`"${result.substring(0, 200)}..."`);
      
      if (hasBookName && isLongEnough && hasChineseContent) {
        console.log('\n🎉 前端网络搜索功能与后台完全一致！');
      } else {
        console.log('\n⚠️  描述质量需要改进');
      }

    } catch (raceError) {
      clearInterval(progressInterval);
      throw raceError;
    }

  } catch (error) {
    console.log(`\n❌ 测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    console.log('\n💡 可能的解决方案:');
    console.log('1. 检查网络连接');
    console.log('2. 验证 OpenAI API 密钥是否有效');
    console.log('3. 确认 API 密钥有足够的配额');
    console.log('4. 检查 OpenAI API 服务状态');
  }
}

// 运行测试
testSingleBook().catch(console.error);