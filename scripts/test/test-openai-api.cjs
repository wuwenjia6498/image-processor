#!/usr/bin/env node

// 测试OpenAI API连接
const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env.local' });

async function testOpenAIAPI() {
  try {
    console.log('🧪 测试OpenAI API连接...\n');
    
    // 检查环境变量
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    console.log('📋 API密钥状态:');
    console.log(`   长度: ${apiKey ? apiKey.length : 0} 字符`);
    console.log(`   前缀: ${apiKey ? apiKey.substring(0, 10) + '...' : '未设置'}`);
    console.log(`   格式: ${apiKey && apiKey.startsWith('sk-') ? '✅ 正确' : '❌ 错误'}`);
    
    if (!apiKey || apiKey === 'sk-proj-your-real-api-key-here' || !apiKey.startsWith('sk-')) {
      console.log('\n❌ OpenAI API密钥未正确配置！');
      console.log('📝 请按以下步骤配置:');
      console.log('1. 访问 https://platform.openai.com/');
      console.log('2. 创建API密钥');
      console.log('3. 在.env.local中替换 VITE_OPENAI_API_KEY 的值');
      console.log('4. 重启开发服务器: npm run dev');
      return;
    }
    
    // 初始化OpenAI客户端
    const openai = new OpenAI({
      apiKey: apiKey,
    });
    
    console.log('\n🔗 测试API连接...');
    
    // 测试简单的文本生成
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "请用中文回复：你好，这是一个API连接测试。"
        }
      ],
      max_tokens: 50
    });
    
    console.log('✅ API连接成功！');
    console.log('📝 测试响应:', response.choices[0].message.content);
    
    console.log('\n🎉 OpenAI API配置正确！');
    console.log('💡 现在您可以在Web界面中获得基于实际图像的详细AI描述。');
    
  } catch (error) {
    console.error('\n❌ API测试失败:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('💡 解决方案: 检查API密钥是否正确');
    } else if (error.message.includes('quota')) {
      console.log('💡 解决方案: 检查API账户余额');
    } else if (error.message.includes('network')) {
      console.log('💡 解决方案: 检查网络连接');
    } else {
      console.log('💡 建议: 检查API密钥和网络连接');
    }
  }
}

testOpenAIAPI(); 