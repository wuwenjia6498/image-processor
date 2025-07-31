import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';
import { generateEnhancedDescription, autoCompleteFields } from './enhanced-ai-service';

// 加载环境变量
import dotenv from 'dotenv';
const result = dotenv.config({ path: '.env.local' });

if (result.error) {
  console.error('❌ 环境变量加载失败:', result.error);
  process.exit(1);
}

// 调试：检查环境变量
console.log('🔍 检查环境变量...');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ 已设置' : '❌ 未设置');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('PINECONE_API_KEY:', process.env.PINECONE_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('');

// 配置网络函数
function configureHuggingFaceNetwork() {
  // 设置HF镜像
  if (!process.env.HF_ENDPOINT) {
    process.env.HF_ENDPOINT = 'https://hf-mirror.com';
  }
  
  // 设置代理（如果需要）
  if (process.env.HTTP_PROXY) {
    console.log(`✓ 使用代理: ${process.env.HTTP_PROXY}`);
  }
  
  console.log(`✓ HF镜像: ${process.env.HF_ENDPOINT}`);
}

// 配置Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // 使用service role key
const supabase = createClient(supabaseUrl, supabaseKey);

// 配置Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});
const index = pinecone.index('image-processor-project');

// 从文件名提取绘本名称
function extractBookTitle(filename: string): string {
  const nameWithoutExt = path.parse(filename).name;
  
  // 特殊处理：如果文件名包含数字+中文的组合
  const numberChineseMatch = nameWithoutExt.match(/\d+[\u4e00-\u9fa5]+.*$/);
  if (numberChineseMatch) {
    let bookTitle = numberChineseMatch[0];
    bookTitle = bookTitle.replace(/-\d+$/, '');
    bookTitle = bookTitle.replace(/\s*\(\d+\)$/, '');
    
    const parts = bookTitle.split(/(\d+)/);
    if (parts.length > 1) {
      let result = '';
      let foundChinese = false;
      for (let i = 0; i < parts.length; i++) {
        if (/\d+/.test(parts[i]) && !foundChinese) {
          result += parts[i];
        } else if (/[\u4e00-\u9fa5]/.test(parts[i])) {
          result += parts[i];
          foundChinese = true;
        } else if (foundChinese && !/^\d+$/.test(parts[i])) {
          result += parts[i];
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
    bookTitle = bookTitle.replace(/-\d+$/, '');
    bookTitle = bookTitle.replace(/\s*\(\d+\)$/, '');
    bookTitle = bookTitle.replace(/\d+$/, '');
    return bookTitle.trim();
  }
  
  return nameWithoutExt;
}

// 编码文件名（用于URL安全）
function encodeFilename(filename: string): string {
  return encodeURIComponent(filename);
}

// 生成唯一ID
function generateAsciiId(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
}

// 获取所有图片文件
function getAllImageFiles(imagesDir: string): string[] {
  if (!fs.existsSync(imagesDir)) {
    console.log(`❌ 图片目录不存在: ${imagesDir}`);
    return [];
  }
  
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => 
    /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file)
  );
  
  return imageFiles.sort();
}

// 生成模拟的向量嵌入
function generateMockEmbedding(): number[] {
  return Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
}

// 增强版图片处理主函数
async function processAllImagesEnhanced() {
  try {
    console.log('🚀 开始增强版图片处理...\n');
    console.log('✨ 新功能：');
    console.log('  • 自动完成待标注字段（年龄定位、文本类型）');
    console.log('  • 集成绘本主旨信息到AI描述');
    console.log('  • 智能主题匹配和关键词提取\n');

    // 配置网络
    configureHuggingFaceNetwork();

    // 获取所有图片文件
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    const imageFiles = getAllImageFiles(imagesDir);
    
    if (imageFiles.length === 0) {
      console.log('❌ 没有找到图片文件');
      return;
    }

    console.log(`📸 找到 ${imageFiles.length} 张图片\n`);

    // 创建CSV数据数组
    const csvData: any[] = [];
    const csvHeader = ['filename', 'book_title', 'ai_description', 'age_orientation', 'text_type_fit', 'book_theme', 'keywords'];

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

        // 2. 生成增强版AI描述（包含主题信息）
        console.log('  🤖 生成增强版AI描述...');
        const enhancedResult = await generateEnhancedDescription(imagePath, bookTitle);
        console.log(`  ✓ 增强描述生成完成: ${enhancedResult.description.substring(0, 50)}...`);
        console.log(`  ✓ 年龄定位: ${enhancedResult.ageOrientation}`);
        console.log(`  ✓ 文本类型: ${enhancedResult.textTypeFit}`);
        console.log(`  ✓ 绘本主题: ${enhancedResult.bookTheme}`);
        console.log(`  ✓ 关键词: ${enhancedResult.keywords.join('、')}`);

        // 3. 生成向量嵌入
        console.log('  🔢 生成向量嵌入...');
        const embedding = generateMockEmbedding();
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
            filename: originalFilename,
            book_title: bookTitle,
            image_url: publicUrl,
            ai_description: enhancedResult.description,
            age_orientation: enhancedResult.ageOrientation,  // 自动完成
            text_type_fit: enhancedResult.textTypeFit,       // 自动完成
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
              filename: originalFilename,
              book_title: bookTitle,
              description: enhancedResult.description,
              image_url: publicUrl,
              age_orientation: enhancedResult.ageOrientation,
              text_type_fit: enhancedResult.textTypeFit,
              book_theme: enhancedResult.bookTheme,
              keywords: enhancedResult.keywords,
              processed_at: new Date().toISOString()
            }
          }]);
          console.log('  ✅ Pinecone存储成功');
        } catch (pineconeError) {
          console.log(`  ⚠️ Pinecone存储失败: ${pineconeError instanceof Error ? pineconeError.message : '未知错误'}`);
        }

        // 9. 添加到CSV数据
        csvData.push({
          filename: originalFilename,
          book_title: bookTitle,
          ai_description: enhancedResult.description,
          age_orientation: enhancedResult.ageOrientation,
          text_type_fit: enhancedResult.textTypeFit,
          book_theme: enhancedResult.bookTheme,
          keywords: enhancedResult.keywords.join('、')
        });

        console.log(`✅ 图片 ${originalFilename} 处理完成！`);

      } catch (error) {
        console.error(`❌ 处理图片 ${originalFilename} 时发生错误:`, error);
        console.log(`⏭️  跳过当前图片，继续处理下一张...`);
        continue;
      }
    }

    // 10. 生成增强版CSV文件
    console.log('\n📄 生成增强版CSV文件...');
    const csvPath = path.join(process.cwd(), 'data', 'all_images_metadata_enhanced.csv');
    
    // 创建CSV内容
    const csvContent = [
      csvHeader.join(','),
      ...csvData.map(row => [
        `"${row.filename}"`,
        `"${row.book_title}"`,
        `"${row.ai_description.replace(/"/g, '""')}"`,
        `"${row.age_orientation}"`,
        `"${row.text_type_fit}"`,
        `"${row.book_theme}"`,
        `"${row.keywords}"`
      ].join(','))
    ].join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✅ 增强版CSV文件已生成: ${csvPath}`);

    console.log('\n🎉 增强版图片处理完成！');
    console.log(`📊 处理统计:`);
    console.log(`   ✅ 成功处理: ${csvData.length} 张图片`);
    console.log(`   🤖 自动完成待标注字段: ${csvData.length} 张`);
    console.log(`   📖 集成绘本主题: ${csvData.length} 张`);
    console.log(`   💾 数据存储: Supabase + Pinecone`);
    console.log(`   📄 CSV文件: ${csvPath}`);

    // 11. 生成处理报告
    console.log('\n📋 处理报告:');
    const ageStats = csvData.reduce((acc, item) => {
      acc[item.age_orientation] = (acc[item.age_orientation] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const textTypeStats = csvData.reduce((acc, item) => {
      acc[item.text_type_fit] = (acc[item.text_type_fit] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    console.log('   📊 年龄分布:');
    Object.entries(ageStats).forEach(([age, count]) => {
      console.log(`      ${age}: ${count} 张`);
    });

    console.log('   📊 文本类型分布:');
    Object.entries(textTypeStats).forEach(([type, count]) => {
      console.log(`      ${type}: ${count} 张`);
    });

  } catch (error) {
    console.error('❌ 处理过程中发生错误:', error);
    throw error;
  }
}

export { processAllImagesEnhanced };

// 直接执行主函数
processAllImagesEnhanced()
  .then(() => {
    console.log('\n🎉 增强版图片处理完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 处理失败:', error);
    process.exit(1);
  }); 