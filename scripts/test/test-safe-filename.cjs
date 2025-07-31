#!/usr/bin/env node

// 测试安全文件名生成（仅使用ASCII字符）
function generateSafeStorageName(filename) {
  // 提取文件扩展名
  const ext = filename.split('.').pop() || 'jpg';
  
  // 生成基于时间戳和随机字符的唯一文件名，完全避免中文字符
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  
  // 使用纯ASCII前缀
  const prefix = 'image';
  
  // 生成安全的文件名：前缀_时间戳_随机字符.扩展名
  return `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
}

console.log('🧪 测试安全文件名生成（纯ASCII版本）...\n');

const testFiles = [
  '31-啊 我生气了!-1.jpg',
  '32-啊 我生气了!-2.jpg', 
  '33-啊 我生气了!.jpg',
  '34-团圆.jpg',
  '35-大大的城市，小小的你-2.jpg',
  '37-大暴雪2.jpg'
];

testFiles.forEach(filename => {
  const safeName = generateSafeStorageName(filename);
  console.log(`原文件名: ${filename}`);
  console.log(`安全文件名: ${safeName}`);
  console.log('---');
});

console.log('✅ 测试完成！');
console.log('💡 新的文件名完全使用ASCII字符，应该可以安全上传到Supabase存储。');
console.log('📝 原始文件名仍会保存在数据库中用于显示。'); 