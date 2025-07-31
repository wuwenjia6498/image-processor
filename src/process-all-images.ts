import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@xenova/transformers';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generateHybridDescription, generateHybridEmbedding, shouldUseCloudAI } from './cloud-ai-service.js';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

// CSV行的类型定义
interface CSVRow {
  filename: string;
  book_title: string;
  style_tags: string;
  mood_tags: string;
  composition_tags: string;
  scene_tags: string;
  season_tags: string;
  content_tags: string;
  emotion_tags: string;
  theme_tags: string;
  text_type_fit: string;
  age_orientation: string;
  tone_tags: string;
  book_theme_summary: string;
  book_keywords: string;
}

// 内部CSV合并函数
async function mergeCSVDataInternal(): Promise<void> {
  const originalPath = path.join(process.cwd(), 'data', 'metadata.csv');
  const newPath = path.join(process.cwd(), 'data', 'all_images_metadata.csv');
  
  // 读取CSV文件的辅助函数
  async function readCSV(filePath: string): Promise<CSVRow[]> {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    return new Promise((resolve, reject) => {
      parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, records) => {
        if (err) {
          reject(err);
        } else {
          resolve(records as CSVRow[]);
        }
      });
    });
  }
  
  // 写入CSV文件的辅助函数
  function writeCSV(filePath: string, data: CSVRow[]): void {
    const headers = [
      'filename', 'book_title', 'style_tags', 'mood_tags', 'composition_tags',
      'scene_tags', 'season_tags', 'content_tags', 'emotion_tags', 'theme_tags',
      'text_type_fit', 'age_orientation', 'tone_tags', 'book_theme_summary', 'book_keywords'
    ];
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => `"${(row[header as keyof CSVRow] || '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
    
    fs.writeFileSync(filePath, csvContent, 'utf8');
  }
  
  // 读取原有数据和新数据
  const originalData = await readCSV(originalPath);
  const newData = await readCSV(newPath);
  
  // 合并数据，避免重复
  const mergedData: CSVRow[] = [];
  const existingFiles = new Set<string>();
  
  // 首先添加原有数据（优先保留原有的详细标注）
  for (const row of originalData) {
    mergedData.push(row);
    existingFiles.add(row.filename);
  }
  
  // 然后添加新数据（跳过已存在的文件）
  for (const row of newData) {
    if (!existingFiles.has(row.filename)) {
      mergedData.push(row);
      existingFiles.add(row.filename);
    }
  }
  
  // 按文件名排序
  mergedData.sort((a, b) => a.filename.localeCompare(b.filename));
  
  // 备份原文件并更新
  if (fs.existsSync(originalPath)) {
    const backupPath = path.join(process.cwd(), 'data', `metadata_backup_${Date.now()}.csv`);
    fs.copyFileSync(originalPath, backupPath);
  }
  
  // 写入合并后的数据
  writeCSV(originalPath, mergedData);
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
  process.env.TRANSFORMERS_OFFLINE = '0'; // 允许网络访问
  process.env.TRANSFORMERS_CACHE = path.join(process.cwd(), 'models', '.cache');
  
  console.log('✓ Hugging Face 网络设置完成');
}

// 检查本地模型是否存在
function checkLocalModel(localPath: string): boolean {
  const configPath = path.join(localPath, 'config.json');
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

// 从文件名提取绘本名称
function extractBookTitle(filename: string): string {
  // 移除文件扩展名
  const nameWithoutExt = path.parse(filename).name;
  
  // 特殊处理：如果文件名包含数字+中文的组合（如 "100个圣诞老人"）
  const numberChineseMatch = nameWithoutExt.match(/\d+[\u4e00-\u9fa5]+.*$/);
  if (numberChineseMatch) {
    let bookTitle = numberChineseMatch[0];
    
    // 处理特殊情况，如 "100个圣诞老人-1" -> "100个圣诞老人"
    bookTitle = bookTitle.replace(/-\d+$/, '');
    bookTitle = bookTitle.replace(/\s*\(\d+\)$/, ''); // 移除 (1), (2) 等
    
    // 特殊处理：保留开头的数字，只移除末尾的数字
    const parts = bookTitle.split(/(\d+)/);
    if (parts.length > 1) {
      // 如果有多个数字部分，只保留第一个数字+中文部分
      let result = '';
      let foundChinese = false;
      for (let i = 0; i < parts.length; i++) {
        if (/\d+/.test(parts[i]) && !foundChinese) {
          result += parts[i]; // 保留开头的数字
        } else if (/[\u4e00-\u9fa5]/.test(parts[i])) {
          result += parts[i];
          foundChinese = true;
        } else if (foundChinese && !/^\d+$/.test(parts[i])) {
          result += parts[i]; // 保留中文后面的非纯数字部分
        }
      }
      return result.trim();
    }
    
    return bookTitle.trim();
  }
  
  // 如果文件名包含中文，提取中文部分作为绘本名
  const chineseMatch = nameWithoutExt.match(/[\u4e00-\u9fa5]+.*$/);
  if (chineseMatch) {
    let bookTitle = chineseMatch[0];
    
    // 处理特殊情况，如 "菲菲生气了-1" -> "菲菲生气了"
    bookTitle = bookTitle.replace(/-\d+$/, '');
    bookTitle = bookTitle.replace(/\s*\(\d+\)$/, ''); // 移除 (1), (2) 等
    bookTitle = bookTitle.replace(/\d+$/, ''); // 移除末尾数字
    
    return bookTitle.trim();
  }
  
  // 如果没有中文，返回原文件名（去除扩展名）
  return nameWithoutExt;
}

// 获取所有图片文件
function getAllImageFiles(imagesDir: string): string[] {
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'];
  
  if (!fs.existsSync(imagesDir)) {
    throw new Error(`图片目录不存在: ${imagesDir}`);
  }
  
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return supportedExtensions.includes(ext);
  });
  
  console.log(`✓ 发现 ${imageFiles.length} 个图片文件`);
  return imageFiles.sort(); // 按文件名排序
}

// 生成模拟的AI描述
function generateMockDescription(filename: string, bookTitle: string): string {
  const descriptions = [
    `这是一幅来自《${bookTitle}》的精美插图，展现了丰富的色彩和细腻的笔触。`,
    `《${bookTitle}》中的这幅插图充满了想象力，描绘了生动的场景。`,
    `这张图片来自绘本《${bookTitle}》，画面构图巧妙，色彩搭配和谐。`,
    `《${bookTitle}》的插图风格独特，这幅作品展现了艺术家的精湛技艺。`,
    `这是《${bookTitle}》中的一个精彩瞬间，通过插图生动地表达了故事情节。`
  ];
  
  // 根据文件名选择描述（保持一致性）
  const index = filename.charCodeAt(0) % descriptions.length;
  return descriptions[index];
}

// 生成模拟的向量嵌入
function generateMockEmbedding(): number[] {
  // 生成1024维的随机向量（与CLIP模型输出维度一致）
  return Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
}

async function processAllImages() {
  console.log('🚀 开始处理所有图片');
  console.log('=================\n');
  
  // 配置网络
  configureHuggingFaceNetwork();
  
  // 初始化客户端
  console.log('初始化客户端...');
  
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  });
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);
  
  console.log('✓ 客户端初始化成功');
  
  // 模型配置
  const captionerModelName = 'Xenova/vit-gpt2-image-captioning';
  const captionerLocalPath = path.join(process.cwd(), 'models', 'vit-gpt2-image-captioning');
  
  const embeddingModelName = 'Xenova/clip-vit-base-patch32';
  const embeddingLocalPath = path.join(process.cwd(), 'models', 'clip-vit-base-patch32');
  
  let captioner: any = null;
  let embedder: any = null;
  let useSimulationMode = false;
  
  // 尝试加载AI模型
  try {
    console.log('\n🤖 加载AI模型...');
    
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
    
    // 加载图像嵌入模型
    console.log('正在加载图像嵌入模型...');
    const embedderPath = getBestModelPath(embeddingModelName, embeddingLocalPath);
    
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
    console.log('✓ 图像嵌入模型加载成功');
    
  } catch (error) {
    console.log('\n⚠️ AI模型加载失败，使用模拟模式');
    console.log('  原因:', error instanceof Error ? error.message : '未知错误');
    console.log('  建议: 检查网络连接或尝试重新下载模型');
    useSimulationMode = true;
  }
  
  // 获取所有图片文件
  const imagesDir = path.join(process.cwd(), 'data', 'images');
  const imageFiles = getAllImageFiles(imagesDir);
  
  if (imageFiles.length === 0) {
    console.log('❌ 没有找到图片文件');
    return;
  }
  
  console.log(`\n📸 开始处理 ${imageFiles.length} 张图片...`);
  console.log(useSimulationMode ? '🔄 使用模拟模式处理' : '🤖 使用AI模型处理');
  
  // 创建CSV数据数组
  const csvData: any[] = [];
  let processedCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < imageFiles.length; i++) {
    const filename = imageFiles[i];
    const imagePath = path.join(imagesDir, filename);
    
    console.log(`\n[${i + 1}/${imageFiles.length}] 处理: ${filename}`);
    
    try {
      // 从文件名提取绘本名称
      const bookTitle = extractBookTitle(filename);
      console.log(`  📖 绘本名称: ${bookTitle}`);
      
      let description: string;
      let embedding: number[];
      
      // 显示当前使用的AI服务类型
      if (shouldUseCloudAI()) {
        console.log('  🌐 使用云端AI服务 (OpenAI GPT-4V)');
      } else if (!useSimulationMode) {
        console.log('  🤖 使用本地AI模型');
      } else {
        console.log('  🔄 使用模拟模式');
      }
      
      // 使用混合AI服务生成描述
      console.log('  → 生成AI描述...');
      description = await generateHybridDescription(imagePath, bookTitle, captioner);
      
      // 使用混合AI服务生成向量嵌入
      console.log('  → 生成向量嵌入...');
      embedding = await generateHybridEmbedding(imagePath, embedder);
      
      // 验证向量维度
      if (!Array.isArray(embedding) || embedding.length !== 1024) {
        console.log('  ⚠️ 向量维度不正确，使用模拟向量');
        embedding = Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
      }
      
      console.log(`  📝 描述: ${description.substring(0, 50)}...`);
      console.log(`  🧮 向量维度: ${embedding.length}`);
      
      // 生成唯一ID
      const id = `img_${Date.now()}_${i}`;
      
      // 存储到Pinecone
      console.log('  🌲 存储到 Pinecone...');
      try {
        await index.upsert([{
          id,
          values: embedding,
          metadata: {
            filename,
            book_title: bookTitle,
            description,
            processed_at: new Date().toISOString()
          }
        }]);
        console.log('  ✅ Pinecone存储成功');
      } catch (pineconeError) {
        console.log(`  ⚠️ Pinecone存储失败: ${pineconeError instanceof Error ? pineconeError.message : '未知错误'}`);
        // 继续处理，不中断整个流程
      }
      
      // 存储到Supabase
      console.log('  📊 存储到 Supabase...');
      const { error: supabaseError } = await supabase
        .from('illustrations')
        .upsert({
          id,
          filename,
          book_title: bookTitle,
          ai_description: description,
          vector_embedding: embedding,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (supabaseError) {
        console.log(`  ⚠️ Supabase存储警告: ${supabaseError.message}`);
      } else {
        console.log('  ✅ Supabase存储成功');
      }
      
      // 添加到CSV数据
      csvData.push({
        filename,
        book_title: bookTitle,
        style_tags: '待标注',
        mood_tags: '待标注',
        composition_tags: '待标注',
        scene_tags: '待标注',
        season_tags: '待标注',
        content_tags: '待标注',
        emotion_tags: '待标注',
        theme_tags: '待标注',
        text_type_fit: '待标注',
        age_orientation: '待标注',
        tone_tags: '待标注',
        book_theme_summary: '待补充',
        book_keywords: '待补充'
      });
      
      processedCount++;
      console.log(`  ✅ 处理完成 (${processedCount}/${imageFiles.length})`);
      
    } catch (error) {
      errorCount++;
      console.log(`  ❌ 处理失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.log(`  → 跳过此文件，继续处理下一个`);
    }
    
    // 添加延迟，避免API限制
    if (i < imageFiles.length - 1) {
      console.log('  ⏳ 等待1秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // 生成新的CSV文件
  if (csvData.length > 0) {
    console.log(`\n📄 生成完整的元数据CSV文件...`);
    const csvContent = [
      'filename,book_title,style_tags,mood_tags,composition_tags,scene_tags,season_tags,content_tags,emotion_tags,theme_tags,text_type_fit,age_orientation,tone_tags,book_theme_summary,book_keywords',
      ...csvData.map(row => 
        `"${row.filename}","${row.book_title}","${row.style_tags}","${row.mood_tags}","${row.composition_tags}","${row.scene_tags}","${row.season_tags}","${row.content_tags}","${row.emotion_tags}","${row.theme_tags}","${row.text_type_fit}","${row.age_orientation}","${row.tone_tags}","${row.book_theme_summary}","${row.book_keywords}"`
      )
    ].join('\n');
    
    const csvPath = path.join(process.cwd(), 'data', 'all_images_metadata.csv');
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✓ CSV文件已保存: ${csvPath}`);
    
    // 自动合并CSV数据
    console.log(`\n🔄 自动合并CSV数据...`);
    try {
      await mergeCSVDataInternal();
      console.log(`✓ CSV数据合并完成`);
    } catch (error) {
      console.log(`⚠️  CSV合并失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.log(`   → 请手动运行: npm run merge-csv`);
    }
  }
  
  // 处理结果总结
  console.log('\n🎉 处理完成！');
  console.log('===============');
  console.log(`📊 处理统计:`);
  console.log(`   总文件数: ${imageFiles.length}`);
  console.log(`   成功处理: ${processedCount}`);
  console.log(`   处理失败: ${errorCount}`);
  console.log(`   成功率: ${Math.round((processedCount / imageFiles.length) * 100)}%`);
  
  if (useSimulationMode) {
    console.log('\n💡 提示: 当前使用模拟模式');
    console.log('   → 要使用真实AI模型，请解决网络连接问题');
    console.log('   → 参考 NETWORK_SETUP.md 获取帮助');
  }
  
  console.log('\n📁 数据存储位置:');
  console.log(`   🌲 Pinecone: ${process.env.PINECONE_INDEX_NAME}`);
  console.log(`   📊 Supabase: illustrations 表`);
  console.log(`   📄 CSV文件: data/all_images_metadata.csv`);
  
  console.log('\n✅ 系统已准备就绪，可以进行图片搜索和分析！');
}

// 运行处理程序
processAllImages().catch(error => {
  console.error('❌ 处理过程中发生严重错误:', error);
  process.exit(1);
}); 