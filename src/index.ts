import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Image Processor 启动中...');
  
  // 检查必要的环境变量
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX_NAME'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('缺少以下环境变量:', missingVars.join(', '));
    console.error('请复制 .env.local.example 为 .env.local 并填入正确的值');
    process.exit(1);
  }
  
  console.log('环境变量检查通过 ✓');
  console.log('项目配置完成，可以开始开发了！');
}

main().catch(console.error); 