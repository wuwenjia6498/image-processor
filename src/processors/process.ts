import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

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

async function main() {
  try {
    console.log('开始初始化客户端...');
    
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
    const indexName = process.env.PINECONE_INDEX_NAME!;
    const index = pinecone.index(indexName);
    console.log(`✓ 连接到 Pinecone 索引: ${indexName}`);

    console.log('开始加载AI模型...');
    
    let captioner = null;
    let embedder = null;
    
    // 定义模型路径
    const captionerModelName = 'Xenova/vit-gpt2-image-captioning';
    const embedderModelName = 'Xenova/clip-vit-base-patch32';
    const captionerLocalPath = path.join(process.cwd(), 'models', 'vit-gpt2-image-captioning');
    const embedderLocalPath = path.join(process.cwd(), 'models', 'clip-vit-base-patch32');
    
    try {
      // 加载图像描述模型
      console.log('正在加载图像描述模型...');
      const captionerPath = getBestModelPath(captionerModelName, captionerLocalPath);
      console.log('  → 这可能需要几分钟时间，请耐心等待...');
      
      captioner = await pipeline('image-to-text', captionerPath, {
        cache_dir: path.join(process.cwd(), 'models', '.cache'),
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            console.log(`  → 下载进度: ${progress.name} - ${Math.round(progress.progress || 0)}%`);
          } else if (progress.status === 'loading') {
            console.log(`  → 加载模型: ${progress.name}`);
          }
        }
      });
      console.log('✓ 图像描述模型加载成功');
    } catch (error) {
      console.log('⚠️ 图像描述模型加载失败，使用模拟模式');
      console.log('  原因:', error instanceof Error ? error.message : '未知错误');
      console.log('  建议: 检查网络连接或尝试重新运行程序');
      captioner = null;
    }

    try {
      // 加载特征提取模型
      console.log('正在加载特征提取模型...');
      const embedderPath = getBestModelPath(embedderModelName, embedderLocalPath);
      console.log('  → 这可能需要几分钟时间，请耐心等待...');
      
      embedder = await pipeline('feature-extraction', embedderPath, {
        cache_dir: path.join(process.cwd(), 'models', '.cache'),
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            console.log(`  → 下载进度: ${progress.name} - ${Math.round(progress.progress || 0)}%`);
          } else if (progress.status === 'loading') {
            console.log(`  → 加载模型: ${progress.name}`);
          }
        }
      });
      console.log('✓ 特征提取模型加载成功');
    } catch (error) {
      console.log('⚠️ 特征提取模型加载失败，使用模拟模式');
      console.log('  原因:', error instanceof Error ? error.message : '未知错误');
      console.log('  建议: 检查网络连接或尝试重新运行程序');
      embedder = null;
    }

    if (captioner && embedder) {
      console.log('✓ 所有AI模型加载完成');
    } else if (captioner || embedder) {
      console.log('⚠️ 部分AI模型加载成功，其余使用模拟模式');
    } else {
      console.log('⚠️ 所有AI模型加载失败，使用完全模拟模式');
      console.log('💡 网络问题解决建议:');
      console.log('   1. 检查 .env.local 中的 HF_ENDPOINT 配置');
      console.log('   2. 确认网络连接正常');
      console.log('   3. 尝试配置代理服务器');
      console.log('   4. 考虑下载模型到本地');
      console.log('   5. 运行 npm run network-check 进行诊断');
    }

    // 读取和处理 data/metadata.csv
    console.log('开始读取 data/metadata.csv...');
    
    // 定义 metadata.csv 的文件路径（在data文件夹下）
    const csvFilePath = path.join(process.cwd(), 'data', 'metadata.csv');
    
    // 检查文件是否存在
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`找不到文件: ${csvFilePath}`);
    }

    // 存储所有解析出的记录
    const records: any[] = [];

    // 使用 Promise 包装 CSV 解析过程，添加UTF-8编码支持
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvFilePath, { encoding: 'utf8' })
        .pipe(parse({
          columns: true, // 将第一行作为表头，每行解析为对象
          skip_empty_lines: true, // 跳过空行
          trim: true, // 去除字段前后的空白字符
          bom: true // 处理BOM标记
        }))
        .on('data', (record) => {
          records.push(record);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    console.log(`✓ CSV文件解析完成，共读取到 ${records.length} 条记录`);

    console.log('开始处理图片记录...');
    
    // 遍历所有记录并处理
    for (const record of records) {
      try {
        console.log(`\n正在处理图片: ${record.filename}`);
        console.log(`  书名: ${record.book_title}`);
        
        // 构建图片文件路径
        const imagePath = path.join(process.cwd(), 'data', 'images', record.filename);
        
        // 检查图片文件是否存在
        if (!fs.existsSync(imagePath)) {
          throw new Error(`图片文件不存在: ${imagePath}`);
        }
        
        // 1. 生成AI描述
        console.log('  → 生成AI描述...');
        let aiDescription = '';
        if (captioner) {
          const result = await captioner(imagePath);
          // 根据transformers.js文档，image-to-text返回格式为 [{generated_text: string}]
          if (Array.isArray(result) && result.length > 0) {
            aiDescription = (result[0] as any).generated_text || `AI生成的${record.book_title}描述`;
          } else {
            aiDescription = `AI生成的${record.book_title}描述`;
          }
        } else {
          aiDescription = `AI生成的${record.book_title}描述 (模拟)`; // 模拟描述
        }
        console.log(`  ✓ AI描述生成完成: ${aiDescription}`);
        
        // 2. 生成图像向量
        console.log('  → 生成图像向量...');
        let imageVector: number[] = [];
        if (embedder) {
          const embedding = await embedder(imagePath, { pooling: 'mean', normalize: true });
          imageVector = Array.from(embedding.data);
        } else {
          // 模拟向量（1024维，匹配Pinecone索引）
          imageVector = Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
        }
        console.log(`  ✓ 图像向量生成完成，维度: ${imageVector.length}`);
        
        // 3. 上传图片到Supabase存储
        console.log('  → 上传图片到Supabase存储...');
        const imageBuffer = fs.readFileSync(imagePath);
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('illustrations')
          .upload(`images/${record.filename}`, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (uploadError) {
          throw new Error(`图片上传失败: ${uploadError.message}`);
        }
        console.log(`  ✓ 图片上传成功: ${uploadData.path}`);
        
        // 4. 获取图片的公开URL
        console.log('  → 获取图片公开URL...');
        const { data: urlData } = supabase.storage
          .from('illustrations')
          .getPublicUrl(`images/${record.filename}`);
        
        const publicUrl = urlData.publicUrl;
        console.log(`  ✓ 获取公开URL成功: ${publicUrl}`);
        
        // 5. 准备Pinecone元数据
        console.log('  → 准备元数据...');
        const pineconeMetadata = {
          filename: record.filename,
          book_title: record.book_title,
          style_tags: record.style_tags?.split(',').map((tag: string) => tag.trim()) || [],
          mood_tags: record.mood_tags?.split(',').map((tag: string) => tag.trim()) || [],
          composition_tags: record.composition_tags?.split(',').map((tag: string) => tag.trim()) || [],
          scene_tags: record.scene_tags?.split(',').map((tag: string) => tag.trim()) || [],
          season_tags: record.season_tags?.split(',').map((tag: string) => tag.trim()) || [],
          content_tags: record.content_tags?.split(',').map((tag: string) => tag.trim()) || [],
          emotion_tags: record.emotion_tags?.split(',').map((tag: string) => tag.trim()) || [],
          theme_tags: record.theme_tags?.split(',').map((tag: string) => tag.trim()) || [],
          tone_tags: record.tone_tags?.split(',').map((tag: string) => tag.trim()) || [],
          text_type_fit: record.text_type_fit,
          age_orientation: record.age_orientation,
          book_theme_summary: record.book_theme_summary,
          book_keywords: record.book_keywords?.split(',').map((keyword: string) => keyword.trim()) || [],
          ai_description: aiDescription,
          image_url: publicUrl
        };
        console.log(`  ✓ 元数据准备完成`);
        
        // 6. 写入Pinecone
        console.log('  → 写入Pinecone向量数据库...');
        await index.upsert([{
          id: record.filename.replace(/\.[^/.]+$/, ""), // 移除文件扩展名作为ID
          values: imageVector,
          metadata: pineconeMetadata
        }]);
        console.log(`  ✓ Pinecone写入成功`);
        
        // 7. 备份到Supabase PostgreSQL
        console.log('  → 备份到Supabase数据库...');
        const { data: dbData, error: dbError } = await supabase
          .from('illustrations')
          .upsert({
            id: record.filename.replace(/\.[^/.]+$/, ""),
            filename: record.filename,
            book_title: record.book_title,
            style_tags: pineconeMetadata.style_tags,
            mood_tags: pineconeMetadata.mood_tags,
            composition_tags: pineconeMetadata.composition_tags,
            scene_tags: pineconeMetadata.scene_tags,
            season_tags: pineconeMetadata.season_tags,
            content_tags: pineconeMetadata.content_tags,
            emotion_tags: pineconeMetadata.emotion_tags,
            theme_tags: pineconeMetadata.theme_tags,
            tone_tags: pineconeMetadata.tone_tags,
            text_type_fit: record.text_type_fit,
            age_orientation: record.age_orientation,
            book_theme_summary: record.book_theme_summary,
            book_keywords: pineconeMetadata.book_keywords,
            ai_description: aiDescription,
            image_url: publicUrl,
            vector_embedding: imageVector,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (dbError) {
          throw new Error(`数据库写入失败: ${dbError.message}`);
        }
        console.log(`  ✓ Supabase数据库备份成功`);
        
        console.log(`✅ 图片 ${record.filename} 处理完成！`);
        
      } catch (error) {
        console.error(`❌ 处理图片 ${record.filename} 时发生错误:`, error);
        console.log(`⏭️  跳过当前图片，继续处理下一张...`);
        continue;
      }
    }

    console.log('\n🎉 所有图片处理完成！');
    
  } catch (error) {
    console.error('初始化过程中发生错误:', error);
    throw error;
  }
}

// 调用 main 函数并捕获错误
main().catch((error) => {
  console.error('程序执行失败:', error);
  process.exit(1);
}); 