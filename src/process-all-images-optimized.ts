import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generateHybridDescription, generateHybridEmbedding, shouldUseCloudAI } from './cloud-ai-service.js';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

// 编码文件名，避免中文字符问题
function encodeFilename(filename: string): string {
  // 移除扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const ext = filename.match(/\.[^/.]+$/)?.[0] || '';
  
  // 提取数字部分
  const numberMatch = nameWithoutExt.match(/^(\d+)/);
  if (numberMatch) {
    const number = numberMatch[1];
    return `${number}${ext}`;
  }
  
  // 如果没有数字，使用原始文件名
  return filename;
}

// 生成ASCII兼容的ID
function generateAsciiId(filename: string): string {
  // 移除扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 提取数字部分
  const numberMatch = nameWithoutExt.match(/^(\d+)/);
  if (numberMatch) {
    return `img_${numberMatch[1]}`;
  }
  
  // 如果没有数字，使用时间戳
  return `img_${Date.now()}`;
}

// 配置 Hugging Face 网络设置
function configureHuggingFaceNetwork() {
  console.log('配置 Hugging Face 网络设置...');
  
  // 设置镜像端点
  if (process.env.HF_ENDPOINT) {
    process.env.HF_ENDPOINT = process.env.HF_ENDPOINT;
    console.log(`✓ 使用 HF 镜像: ${process.env.HF_ENDPOINT}`);
  } else {
    // 默认使用 HF-Mirror
    process.env.HF_ENDPOINT = 'https://hf-mirror.com';
    console.log('✓ 使用默认 HF-Mirror: https://hf-mirror.com');
  }
  
  // 设置代理（如果配置了）
  if (process.env.HTTP_PROXY) {
    console.log(`✓ 使用 HTTP 代理: ${process.env.HTTP_PROXY}`);
  }
  if (process.env.HTTPS_PROXY) {
    console.log(`✓ 使用 HTTPS 代理: ${process.env.HTTPS_PROXY}`);
  }
  
  // 设置 HF Token（如果配置了）
  if (process.env.HF_TOKEN) {
    console.log('✓ 检测到 Hugging Face Token');
  }
  
  // 设置超时和重试参数
  process.env.HF_HUB_DOWNLOAD_TIMEOUT = '300'; // 5分钟超时
  
  // 设置本地优先模式
  process.env.TRANSFORMERS_OFFLINE = '0'; // 允许网络访问但优先本地
  process.env.HF_HUB_OFFLINE = '0'; // 允许网络访问但优先本地
  
  console.log('✓ 网络配置完成');
}

// 检查本地模型是否存在
function checkLocalModel(modelPath: string): boolean {
  const configPath = path.join(modelPath, 'config.json');
  return fs.existsSync(configPath);
}

// 获取最佳可用的模型路径
function getBestModelPath(modelName: string, localPath: string): string {
  if (checkLocalModel(localPath)) {
    console.log(`✓ 检测到本地模型: ${localPath}`);
    // 使用相对路径，避免Windows路径问题
    return localPath.replace(process.cwd() + path.sep, './');
  } else {
    console.log(`→ 本地模型不存在，使用在线模型: ${modelName}`);
    return modelName;
  }
}

// 从文件名提取绘本标题
function extractBookTitle(filename: string): string {
  // 移除文件扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // 匹配数字-中文标题的模式
  const match = nameWithoutExt.match(/^\d+-(.+)$/);
  if (match) {
    return match[1];
  }
  
  // 如果没有匹配到模式，返回原始文件名
  return nameWithoutExt;
}

// 简化的CSV行接口
interface CSVRow {
  filename: string;
  book_title: string;
  ai_description: string;
  age_orientation: string;
  text_type_fit: string;
}

async function processAllImagesOptimized() {
  try {
    console.log('🚀 开始优化版本图片处理...\n');
    
    // 首先配置网络设置
    configureHuggingFaceNetwork();

    // 检查必要的环境变量
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PINECONE_API_KEY',
      'PINECONE_INDEX_NAME'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`缺少以下环境变量: ${missingVars.join(', ')}`);
    }

    // 初始化 Pinecone 客户端
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    });
    console.log('✓ Pinecone 客户端初始化成功');

    // 初始化 Supabase 客户端
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('✓ Supabase 客户端初始化成功');

    // 获取 Pinecone 索引
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);
    console.log('✓ Pinecone 索引获取成功');

    // 读取图片目录
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    if (!fs.existsSync(imagesDir)) {
      throw new Error(`图片目录不存在: ${imagesDir}`);
    }

    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file))
      .sort();

    console.log(`📁 找到 ${imageFiles.length} 张图片\n`);

    // 准备CSV数据
    const csvData: CSVRow[] = [];
    const csvHeader = ['filename', 'book_title', 'ai_description', 'age_orientation', 'text_type_fit'];

    // 检查是否使用云端AI
    const useCloudAI = shouldUseCloudAI();
    console.log(`🤖 AI模式: ${useCloudAI ? '云端GPT-4V' : '本地模型'}`);

    // 初始化本地模型（如果需要）
    let captioner: any = null;
    let embedder: any = null;
    
    if (!useCloudAI) {
      console.log('📥 初始化本地AI模型...');
      try {
        // 尝试加载图像描述模型
        const captionModelPath = getBestModelPath(
          'Xenova/vit-gpt2-image-captioning',
          path.join(process.cwd(), 'models', 'vit-gpt2-image-captioning')
        );
        captioner = await pipeline('image-to-text', captionModelPath);
        console.log('✓ 图像描述模型加载成功');

        // 尝试加载特征提取模型
        const embedModelPath = getBestModelPath(
          'Xenova/clip-vit-base-patch32',
          path.join(process.cwd(), 'models', 'clip-vit-base-patch32')
        );
        embedder = await pipeline('feature-extraction', embedModelPath);
        console.log('✓ 特征提取模型加载成功');
      } catch (modelError) {
        console.log('⚠️ 本地模型加载失败，将使用模拟模式');
        console.log(`   错误详情: ${modelError instanceof Error ? modelError.message : '未知错误'}`);
      }
    }

    // 处理每张图片
    for (let i = 0; i < imageFiles.length; i++) {
      const originalFilename = imageFiles[i];
      const encodedFilename = encodeFilename(originalFilename);
      const imagePath = path.join(imagesDir, originalFilename);
      
      console.log(`\n🖼️  处理图片 ${i + 1}/${imageFiles.length}: ${originalFilename}`);
      console.log(`   编码文件名: ${encodedFilename}`);
      
      try {
        // 1. 提取绘本标题
        const bookTitle = extractBookTitle(originalFilename);
        console.log(`  📖 绘本标题: ${bookTitle}`);

        // 2. 生成AI描述
        console.log('  🤖 生成AI描述...');
        const description = await generateHybridDescription(imagePath, bookTitle, captioner);
        console.log(`  ✓ AI描述生成完成: ${description.substring(0, 50)}...`);

        // 3. 生成向量嵌入
        console.log('  🔢 生成向量嵌入...');
        const embedding = await generateHybridEmbedding(imagePath, embedder);
        console.log(`  ✓ 向量嵌入生成完成，维度: ${embedding.length}`);

        // 4. 上传图片到Supabase存储
        console.log('  ☁️ 上传图片到Supabase存储...');
        const imageBuffer = fs.readFileSync(imagePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('illustrations')
          .upload(`images/${encodedFilename}`, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (uploadError) {
          throw new Error(`图片上传失败: ${uploadError.message}`);
        }
        console.log(`  ✓ 图片上传成功: ${uploadData.path}`);
        
        // 5. 获取图片的公开URL
        console.log('  🔗 获取图片公开URL...');
        const { data: urlData } = supabase.storage
          .from('illustrations')
          .getPublicUrl(`images/${encodedFilename}`);
        
        const publicUrl = urlData.publicUrl;
        console.log(`  ✓ 获取公开URL成功: ${publicUrl}`);

        // 6. 生成唯一ID
        const id = generateAsciiId(originalFilename);

        // 7. 存储到Supabase（使用优化表）
        console.log('  💾 存储到Supabase...');
        const { error: supabaseError } = await supabase
          .from('illustrations_optimized')
          .upsert({
            id,
            filename: originalFilename, // 保存原始文件名
            book_title: bookTitle,
            image_url: publicUrl, // 使用生成的公开URL
            ai_description: description,
            age_orientation: '待标注',  // 保留用于人工标注
            text_type_fit: '待标注',    // 保留用于人工标注
            vector_embedding: embedding,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (supabaseError) {
          throw new Error(`Supabase存储失败: ${supabaseError.message}`);
        }
        console.log('  ✅ Supabase存储成功');

        // 8. 存储到Pinecone
        console.log('  🌲 存储到 Pinecone...');
        try {
          await index.upsert([{
            id,
            values: embedding,
            metadata: {
              filename: originalFilename, // 保存原始文件名
              book_title: bookTitle,
              description,
              image_url: publicUrl, // 添加图片URL到Pinecone元数据
              processed_at: new Date().toISOString()
            }
          }]);
          console.log('  ✅ Pinecone存储成功');
        } catch (pineconeError) {
          console.log(`  ⚠️ Pinecone存储失败: ${pineconeError instanceof Error ? pineconeError.message : '未知错误'}`);
          // 继续处理，不中断整个流程
        }

        // 9. 添加到CSV数据
        csvData.push({
          filename: originalFilename,
          book_title: bookTitle,
          ai_description: description,
          age_orientation: '待标注',
          text_type_fit: '待标注'
        });

        console.log(`✅ 图片 ${originalFilename} 处理完成！`);

      } catch (error) {
        console.error(`❌ 处理图片 ${originalFilename} 时发生错误:`, error);
        console.log(`⏭️  跳过当前图片，继续处理下一张...`);
        continue;
      }
    }

    // 10. 生成CSV文件
    console.log('\n📄 生成CSV文件...');
    const csvPath = path.join(process.cwd(), 'data', 'all_images_metadata_optimized.csv');
    
    // 创建CSV内容
    const csvContent = [
      csvHeader.join(','),
      ...csvData.map(row => [
        `"${row.filename}"`,
        `"${row.book_title}"`,
        `"${row.ai_description.replace(/"/g, '""')}"`, // 转义双引号
        `"${row.age_orientation}"`,
        `"${row.text_type_fit}"`
      ].join(','))
    ].join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✅ CSV文件已生成: ${csvPath}`);

    console.log('\n🎉 所有图片处理完成！');
    console.log(`📊 处理统计:`);
    console.log(`   ✅ 成功处理: ${csvData.length} 张图片`);
    console.log(`   📁 图片URL: 已生成并存储到数据库`);
    console.log(`   💾 数据存储: Supabase + Pinecone`);
    console.log(`   📄 CSV文件: ${csvPath}`);

  } catch (error) {
    console.error('❌ 处理过程中发生错误:', error);
    throw error;
  }
}

export { processAllImagesOptimized };

// 如果直接运行此文件，则执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllImagesOptimized().catch(console.error);
} 