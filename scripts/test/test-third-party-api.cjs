#!/usr/bin/env node

// 测试第三方OpenAI API连接
const { OpenAI } = require('openai');
require('dotenv').config({ path: '.env.local' });

async function testThirdPartyAPI() {
  try {
    console.log('🧪 测试第三方OpenAI API连接...\n');
    
    // 检查环境变量
    const apiKey = process.env.VITE_OPENAI_API_KEY;
    const baseURL = process.env.VITE_OPENAI_BASE_URL;
    
    console.log('📋 API配置状态:');
    console.log(`   API密钥: ${apiKey ? apiKey.substring(0, 10) + '...' : '未设置'}`);
    console.log(`   基础URL: ${baseURL || '未设置'}`);
    console.log(`   格式: ${apiKey && apiKey.startsWith('sk-') ? '✅ 正确' : '❌ 错误'}`);
    
    if (!apiKey || !baseURL) {
      console.log('\n❌ API配置不完整！');
      console.log('📝 请检查.env.local文件中的配置');
      return;
    }
    
    // 初始化OpenAI客户端
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
    
    console.log('\n🔗 测试API连接...');
    
    // 测试简单的文本生成
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: "请用中文回复：你好，这是一个第三方API连接测试。"
        }
      ],
      max_tokens: 50
    });
    
    console.log('✅ 第三方API连接成功！');
    console.log('📝 测试响应:', response.choices[0].message.content);
    
    console.log('\n🎉 第三方OpenAI API配置正确！');
    console.log('💡 现在您可以在Web界面中使用第三方API服务。');
    
  } catch (error) {
    console.error('\n❌ API测试失败:', error.message);
    
    if (error.message.includes('401')) {
      console.log('💡 解决方案: 检查API密钥是否正确');
    } else if (error.message.includes('404')) {
      console.log('💡 解决方案: 检查基础URL是否正确');
    } else if (error.message.includes('network')) {
      console.log('💡 解决方案: 检查网络连接');
    } else {
      console.log('💡 建议: 检查API密钥、基础URL和网络连接');
    }
  }
}

testThirdPartyAPI(); 