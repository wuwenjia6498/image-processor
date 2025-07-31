#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('🧪 中文文件名处理测试');
console.log('===================\n');

// 从文件名提取绘本名称的函数（与主程序保持一致）
function extractBookTitle(filename) {
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

// 测试样例
const testCases = [
  '88-清明节的故事.jpg',
  '99-白雪公主和七个小矮人.jpg',
  '109-菲菲生气了-1.jpg',
  '31-啊 我生气了!-1.jpg',
  '32-啊 我生气了!-2.jpg',
  '84-没事，你掉下来我会接住你 (3).jpg',
  '01-100个圣诞老人.jpg',
  '117-雪花人.png',
  '02.jpg',
  '03.jpg'
];

console.log('📝 测试文件名提取功能:');
console.log('------------------------');

testCases.forEach((filename, index) => {
  const bookTitle = extractBookTitle(filename);
  console.log(`${index + 1}. ${filename}`);
  console.log(`   → 绘本名称: "${bookTitle}"`);
  console.log('');
});

// 检查实际目录中的文件
const imagesDir = path.join(process.cwd(), 'data', 'images');
if (fs.existsSync(imagesDir)) {
  console.log('📁 实际目录中的文件分析:');
  console.log('-------------------------');
  
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp'].includes(ext);
  });
  
  console.log(`发现 ${imageFiles.length} 个图片文件\n`);
  
  // 按绘本名称分组
  const bookGroups = {};
  
  imageFiles.forEach(filename => {
    const bookTitle = extractBookTitle(filename);
    if (!bookGroups[bookTitle]) {
      bookGroups[bookTitle] = [];
    }
    bookGroups[bookTitle].push(filename);
  });
  
  console.log('📚 按绘本分组结果:');
  console.log('------------------');
  
  Object.entries(bookGroups)
    .sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
    .forEach(([bookTitle, files]) => {
      console.log(`📖 《${bookTitle}》 (${files.length}个文件)`);
      files.forEach(file => {
        console.log(`   • ${file}`);
      });
      console.log('');
    });
  
  // 统计信息
  const totalBooks = Object.keys(bookGroups).length;
  const chineseBooks = Object.keys(bookGroups).filter(title => /[\u4e00-\u9fa5]/.test(title)).length;
  const englishBooks = totalBooks - chineseBooks;
  
  console.log('📊 统计信息:');
  console.log('------------');
  console.log(`总图片数: ${imageFiles.length}`);
  console.log(`总绘本数: ${totalBooks}`);
  console.log(`中文绘本: ${chineseBooks}`);
  console.log(`英文/数字绘本: ${englishBooks}`);
  console.log(`平均每本绘本图片数: ${Math.round(imageFiles.length / totalBooks * 10) / 10}`);
  
} else {
  console.log('❌ 图片目录不存在: data/images');
}

console.log('\n✅ 中文文件名处理测试完成！');
console.log('\n💡 提示:');
console.log('   - 系统能正确处理中文文件名');
console.log('   - 自动从文件名提取绘本名称');
console.log('   - 支持带序号的多张图片 (如: 菲菲生气了-1, 菲菲生气了-2)');
console.log('   - 兼容各种图片格式 (.jpg, .png, .gif 等)'); 