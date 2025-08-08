#!/usr/bin/env node

/**
 * 处理单张图片脚本
 * 测试IMAGE_URL生成功能
 */

const { createClient } = require('@supabase/supabase-js');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// 编码文件名，避免中文字符问题
function encodeFilename(filename) {
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

async function processSingleImage() {
  console.log('🖼️ 处理单张图片测试\n');
  
  try {
    // 初始化客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    // 选择一张测试图片
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file))
      .sort();
    
    if (imageFiles.length === 0) {
      throw new Error('没有找到图片文件');
    }
    
    const originalFilename = imageFiles[0]; // 使用第一张图片
    const encodedFilename = encodeFilename(originalFilename);
    const imagePath = path.join(imagesDir, originalFilename);
    
    console.log(`📁 原始文件名: ${originalFilename}`);
    console.log(`📁 编码文件名: ${encodedFilename}`);
    
    // 1. 提取绘本标题
    const bookTitle = originalFilename.replace(/\.[^/.]+$/, "").replace(/^\d+-(.+)$/, '$1');
    console.log(`📖 绘本标题: ${bookTitle}`);
    
    // 2. 生成模拟AI描述
    const description = `AI生成的${bookTitle}描述 (模拟) - 这是一张温馨的绘本插图，展现了${bookTitle}的故事情节。画面色彩丰富，构图精美，适合儿童阅读。`;
    console.log(`🤖 AI描述: ${description.substring(0, 50)}...`);
    
    // 3. 生成模拟向量
    const embedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
    console.log(`🔢 向量维度: ${embedding.length}`);
    
    // 4. 上传图片到Supabase存储
    console.log('☁️ 上传图片到Supabase存储...');
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
    console.log(`✓ 图片上传成功: ${uploadData.path}`);
    
    // 5. 获取图片的公开URL
    console.log('🔗 获取图片公开URL...');
    const { data: urlData } = supabase.storage
      .from('illustrations')
      .getPublicUrl(`images/${encodedFilename}`);
    
    const publicUrl = urlData.publicUrl;
    console.log(`✓ 公开URL: ${publicUrl}`);
    
    // 6. 生成唯一ID
    const id = originalFilename.replace(/\.[^/.]+$/, "");
    
    // 7. 存储到Supabase（使用优化表）
    console.log('💾 存储到Supabase...');
    const { error: supabaseError } = await supabase
      .from('illustrations_optimized')
      .upsert({
        id,
        filename: originalFilename, // 保存原始文件名
        book_title: bookTitle,
        image_url: publicUrl,
        ai_description: description,
        age_orientation: '待标注',
        text_type_fit: '待标注',
        vector_embedding: embedding,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (supabaseError) {
      throw new Error(`Supabase存储失败: ${supabaseError.message}`);
    }
    console.log('✅ Supabase存储成功');
    
    // 8. 存储到Pinecone
    console.log('🌲 存储到Pinecone...');
    try {
      await index.upsert([{
        id,
        values: embedding,
        metadata: {
          filename: originalFilename, // 保存原始文件名
          book_title: bookTitle,
          description,
          image_url: publicUrl,
          processed_at: new Date().toISOString()
        }
      }]);
      console.log('✅ Pinecone存储成功');
    } catch (pineconeError) {
      console.log(`⚠️ Pinecone存储失败: ${pineconeError.message}`);
    }
    
    console.log('\n🎉 单张图片处理完成！');
    console.log(`📊 结果:`);
    console.log(`   📁 原始文件名: ${originalFilename}`);
    console.log(`   📁 存储文件名: ${encodedFilename}`);
    console.log(`   📖 绘本标题: ${bookTitle}`);
    console.log(`   🔗 图片URL: ${publicUrl}`);
    console.log(`   💾 数据库: Supabase + Pinecone`);
    
  } catch (error) {
    console.log('❌ 处理失败:', error.message);
  }
}

if (require.main === module) {
  processSingleImage();
} 