#!/usr/bin/env node

/**
 * 批量上传图片脚本
 * 为所有图片生成IMAGE_URL
 */

const { createClient } = require('@supabase/supabase-js');
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

// 从文件名提取绘本标题
function extractBookTitle(filename) {
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

async function batchUploadImages() {
  console.log('🖼️ 批量上传图片生成IMAGE_URL\n');
  
  try {
    // 初始化Supabase客户端
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // 读取图片目录
    const imagesDir = path.join(process.cwd(), 'data', 'images');
    if (!fs.existsSync(imagesDir)) {
      throw new Error(`图片目录不存在: ${imagesDir}`);
    }
    
    const imageFiles = fs.readdirSync(imagesDir)
      .filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file))
      .sort();
    
    console.log(`📁 找到 ${imageFiles.length} 张图片`);
    
    // 准备CSV数据
    const csvData = [];
    const csvHeader = ['filename', 'book_title', 'image_url', 'encoded_filename'];
    
    let successCount = 0;
    let errorCount = 0;
    
    // 处理每张图片
    for (let i = 0; i < imageFiles.length; i++) {
      const originalFilename = imageFiles[i];
      const encodedFilename = encodeFilename(originalFilename);
      const imagePath = path.join(imagesDir, originalFilename);
      
      console.log(`\n[${i + 1}/${imageFiles.length}] 处理: ${originalFilename}`);
      console.log(`   编码文件名: ${encodedFilename}`);
      
      try {
        // 1. 提取绘本标题
        const bookTitle = extractBookTitle(originalFilename);
        console.log(`   📖 绘本标题: ${bookTitle}`);
        
        // 2. 读取图片文件
        const imageBuffer = fs.readFileSync(imagePath);
        console.log(`   📄 文件大小: ${imageBuffer.length} bytes`);
        
        // 3. 上传图片到Supabase存储
        console.log('   ☁️ 上传到Supabase存储...');
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('illustrations')
          .upload(`images/${encodedFilename}`, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (uploadError) {
          throw new Error(`上传失败: ${uploadError.message}`);
        }
        console.log(`   ✓ 上传成功: ${uploadData.path}`);
        
        // 4. 获取图片的公开URL
        console.log('   🔗 获取公开URL...');
        const { data: urlData } = supabase.storage
          .from('illustrations')
          .getPublicUrl(`images/${encodedFilename}`);
        
        const publicUrl = urlData.publicUrl;
        console.log(`   ✓ 公开URL: ${publicUrl}`);
        
        // 5. 添加到CSV数据
        csvData.push({
          filename: originalFilename,
          book_title: bookTitle,
          image_url: publicUrl,
          encoded_filename: encodedFilename
        });
        
        successCount++;
        console.log(`   ✅ 处理完成`);
        
      } catch (error) {
        errorCount++;
        console.log(`   ❌ 处理失败: ${error.message}`);
        continue;
      }
    }
    
    // 6. 生成CSV文件
    console.log('\n📄 生成CSV文件...');
    const csvPath = path.join(process.cwd(), 'data', 'image_urls.csv');
    
    const csvContent = [
      csvHeader.join(','),
      ...csvData.map(row => [
        `"${row.filename}"`,
        `"${row.book_title}"`,
        `"${row.image_url}"`,
        `"${row.encoded_filename}"`
      ].join(','))
    ].join('\n');
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    console.log(`✅ CSV文件已生成: ${csvPath}`);
    
    // 7. 统计报告
    console.log('\n📊 处理统计:');
    console.log(`   ✅ 成功: ${successCount} 张图片`);
    console.log(`   ❌ 失败: ${errorCount} 张图片`);
    console.log(`   📈 成功率: ${Math.round((successCount / imageFiles.length) * 100)}%`);
    console.log(`   📄 CSV记录: ${csvData.length} 条`);
    
    // 8. 显示前5个URL示例
    console.log('\n🔗 前5个图片URL示例:');
    csvData.slice(0, 5).forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.filename}`);
      console.log(`      URL: ${row.image_url}`);
    });
    
    console.log('\n🎉 批量上传完成！');
    console.log('\n💡 下一步:');
    console.log('   1. 检查生成的CSV文件');
    console.log('   2. 验证图片URL可访问性');
    console.log('   3. 将URL更新到数据库');
    
  } catch (error) {
    console.log('❌ 批量上传失败:', error.message);
  }
}

if (require.main === module) {
  batchUploadImages();
} 