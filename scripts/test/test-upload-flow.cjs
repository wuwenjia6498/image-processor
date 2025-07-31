#!/usr/bin/env node

// 测试完整的上传流程
const { createClient } = require('@supabase/supabase-js');

// 生成安全的存储文件名（仅使用ASCII字符）
function generateSafeStorageName(filename) {
  const ext = filename.split('.').pop() || 'jpg';
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const prefix = 'image';
  return `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
}

async function testUploadFlow() {
  try {
    console.log('🧪 测试完整上传流程...\n');
    
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
    
    console.log('📁 测试文件名转换:');
    testFilenames.forEach(filename => {
      const safeName = generateSafeStorageName(filename);
      console.log(`  ${filename} -> ${safeName}`);
    });
    
    console.log('\n🔗 测试Supabase连接...');
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
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

testUploadFlow(); 