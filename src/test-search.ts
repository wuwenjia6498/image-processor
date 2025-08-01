import { searchBookInfo, buildEnhancedPrompt } from './services/bookSearch';
import dotenv from 'dotenv';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

async function testSearch() {
  try {
    console.log('🧪 开始测试Serper API搜索功能...\n');

    // 测试绘本列表
    const testBooks = [
      '14只老鼠的摇篮曲',
      '三个强盗',
      '圣诞夜的空袜子',
      '有一天',
      '最好喝的汤'
    ];

    for (const bookTitle of testBooks) {
      console.log(`📚 测试绘本: 《${bookTitle}》`);
      console.log('─'.repeat(50));

      // 搜索绘本信息
      const searchResults = await searchBookInfo(bookTitle);

      if (searchResults.length > 0) {
        console.log(`✅ 找到 ${searchResults.length} 条搜索结果:`);
        
        // 显示前3条搜索结果
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`\n${index + 1}. ${result.title}`);
          console.log(`   链接: ${result.link}`);
          console.log(`   摘要: ${result.snippet.substring(0, 100)}...`);
        });

        // 构建增强提示词
        const enhancedPrompt = buildEnhancedPrompt(bookTitle, searchResults);
        console.log(`\n📝 生成的增强提示词:`);
        console.log(enhancedPrompt.substring(0, 300) + '...');
      } else {
        console.log('❌ 未找到搜索结果');
      }

      console.log('\n' + '='.repeat(60) + '\n');
      
      // 添加延迟，避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🎉 搜索功能测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testSearch(); 