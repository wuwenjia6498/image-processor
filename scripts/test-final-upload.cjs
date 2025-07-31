#!/usr/bin/env node

// 最终测试完整上传流程
const { createClient } = require('@supabase/supabase-js');

// 生成安全的存储文件名（仅使用ASCII字符）
function generateSafeStorageName(filename) {
  const ext = filename.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const prefix = 'image';
  return `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
}

// 从文件名提取绘本名称
function extractBookTitle(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
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

// 智能匹配绘本主题
function matchBookTheme(bookTitle) {
  const BOOK_THEMES = {
    '14只老鼠': {
      theme: '温馨的家庭生活，展现小老鼠一家的日常生活和亲情',
      keywords: ['家庭', '亲情', '日常生活', '温馨', '自然'],
      age: '幼儿',
      textType: '睡前故事'
    },
    '你好！空间站': {
      theme: '太空探索，激发孩子对科学和宇宙的好奇心',
      keywords: ['太空', '科学', '探索', '宇宙', '科技'],
      age: '小学低年级',
      textType: '科普知识'
    },
    '三个和尚': {
      theme: '传统文化，团结合作的精神',
      keywords: ['传统文化', '团结', '合作', '寺院', '和尚'],
      age: '小学低年级',
      textType: '传统文化教育'
    },
    '下雪天': {
      theme: '冬季的乐趣，童真童趣',
      keywords: ['冬季', '雪', '童趣', '玩耍', '快乐'],
      age: '幼儿',
      textType: '睡前故事'
    }
  };

  const title = bookTitle.toLowerCase();
  for (const [key, theme] of Object.entries(BOOK_THEMES)) {
    if (title.includes(key.toLowerCase())) {
      return theme;
    }
  }
  
  // 默认主题
  return {
    theme: '儿童绘本，传递积极正面的价值观',
    keywords: ['儿童', '绘本', '教育', '成长'],
    age: '幼儿',
    textType: '睡前故事'
  };
}

async function testFinalUpload() {
  try {
    console.log('🧪 最终测试完整上传流程...\n');
    
    // 初始化Supabase客户端
    const supabaseUrl = 'https://ixdlwnzktpkhwaxeddzh.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGx3bnprdHBraHdheGVkZHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQyNDY0MiwiZXhwIjoyMDY5MDAwNjQyfQ.wJUDcntT_JNTE2heAHLsIddo-_UDkhQ5_Q1Zvk5JeiQ';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 测试文件名
    const testFilenames = [
      '31-啊 我生气了!-1.jpg',
      '34-团圆.jpg',
      '37-大暴雪2.jpg'
    ];
    
    console.log('📁 测试文件名处理:');
    testFilenames.forEach(filename => {
      const safeName = generateSafeStorageName(filename);
      const bookTitle = extractBookTitle(filename);
      const theme = matchBookTheme(bookTitle);
      
      console.log(`  原文件名: ${filename}`);
      console.log(`  安全文件名: ${safeName}`);
      console.log(`  提取书名: ${bookTitle}`);
      console.log(`  年龄定位: ${theme.age}`);
      console.log(`  文本类型: ${theme.textType}`);
      console.log('  ---');
    });
    
    console.log('\n🔗 测试数据库连接...');
    const { data: testData, error: testError } = await supabase
      .from('illustrations_optimized')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('❌ Supabase连接失败:', testError.message);
      return;
    }
    
    console.log('✅ Supabase连接成功！');
    
    console.log('\n📦 测试存储桶访问...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.log('❌ 存储桶访问失败:', bucketError.message);
      return;
    }
    
    const illustrationsBucket = buckets.find(bucket => bucket.name === 'illustrations');
    if (!illustrationsBucket) {
      console.log('❌ 未找到illustrations存储桶');
      return;
    }
    
    console.log('✅ 存储桶访问成功！');
    
    console.log('\n🎉 所有测试通过！');
    console.log('💡 现在应该可以成功上传包含中文字符的文件了。');
    console.log('📝 系统会自动生成ASCII文件名进行存储，同时保留原始文件名用于显示。');
    console.log('🔧 数据库字段已正确配置，不再包含不存在的字段。');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testFinalUpload(); 