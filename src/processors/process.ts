import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse';
import { searchBookInfo, buildEnhancedPrompt } from '../services/bookSearch';

// 配置 dotenv 以加载根目录下的 .env.local 文件
dotenv.config({ path: '.env.local' });

async function main() {
  try {
    console.log('开始初始化客户端...');

    // 检查必要的环境变量
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PINECONE_API_KEY',
      'PINECONE_INDEX_NAME',
      'OPENAI_API_KEY',
      'SERPER_API_KEY'
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

    console.log('✓ 使用OpenAI API + Serper搜索进行图像处理');

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
        
        // 1. 搜索绘本信息
        console.log('  → 搜索绘本信息...');
        const searchResults = await searchBookInfo(record.book_title);
        
        // 2. 生成AI描述
        console.log('  → 生成AI描述...');
        let aiDescription = '';
        if (process.env.OPENAI_API_KEY) {
          try {
            // 读取图像文件并转换为base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            // 构建增强的提示词
            const promptText = buildEnhancedPrompt(record.book_title, searchResults);
            
            // 使用OpenAI Vision API进行图像描述
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: "gpt-4-vision-preview",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: promptText
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:image/jpeg;base64,${base64Image}`
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 1000
              })
            });

            if (!response.ok) {
              throw new Error(`OpenAI API 调用失败: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
              aiDescription = data.choices[0].message.content;
            } else {
              aiDescription = `AI生成的${record.book_title}描述 (模拟)`;
            }
          } catch (error) {
            console.log(`  ⚠️ OpenAI API调用失败: ${error instanceof Error ? error.message : '未知错误'}`);
            aiDescription = `AI生成的${record.book_title}描述 (模拟)`;
          }
        } else {
          aiDescription = `AI生成的${record.book_title}描述 (模拟)`;
        }
        console.log(`  ✓ AI描述生成完成: ${aiDescription.substring(0, 50)}...`);
        
        // 3. 生成图像向量
        console.log('  → 生成图像向量...');
        let imageVector: number[] = [];
        // 模拟向量（1536维，匹配Pinecone索引）
        console.log('  🔢 生成向量嵌入（模拟）...');
        imageVector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
        console.log(`  ✓ 图像向量生成完成，维度: ${imageVector.length}`);
        
        // 4. 上传图片到Supabase存储
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
        
        // 5. 获取图片的公开URL
        console.log('  → 获取图片公开URL...');
        const { data: urlData } = supabase.storage
          .from('illustrations')
          .getPublicUrl(`images/${record.filename}`);
        
        const publicUrl = urlData.publicUrl;
        console.log(`  ✓ 获取公开URL成功: ${publicUrl}`);
        
        // 6. 准备Pinecone元数据
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
          image_url: publicUrl,
          search_results_count: searchResults.length
        };
        console.log(`  ✓ 元数据准备完成`);
        
        // 7. 写入Pinecone
        console.log('  → 写入Pinecone向量数据库...');
        await index.upsert([{
          id: record.filename.replace(/\.[^/.]+$/, ""), // 移除文件扩展名作为ID
          values: imageVector,
          metadata: pineconeMetadata
        }]);
        console.log(`  ✓ Pinecone写入成功`);
        
        // 8. 备份到Supabase PostgreSQL
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
            original_description: aiDescription,
            image_url: publicUrl,
            original_embedding: imageVector,
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