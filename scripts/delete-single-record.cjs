const { createClient } = require('@supabase/supabase-js');

// 从环境变量或.env文件读取配置
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 请确保设置了 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 带超时的数据库操作
async function withTimeout(promise, timeoutMs = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('操作超时')), timeoutMs)
    )
  ]);
}

// 删除单个记录
async function deleteSingleRecord(filename) {
  console.log('🗑️ 单独删除文件记录');
  console.log('==========================================');
  console.log(`📁 目标文件: ${filename}`);
  console.log('⏱️ 操作超时设置: 15秒');
  console.log('');
  
  try {
    console.log('🔍 步骤1: 查找记录...');
    
    // 查找记录（15秒超时）
    const searchResult = await withTimeout(
      supabase
        .from('illustrations_optimized')
        .select('id, filename, image_url, book_title')
        .eq('filename', filename),
      15000
    );
    
    const { data: records, error: searchError } = searchResult;
    
    if (searchError) {
      throw new Error(`查找记录失败: ${searchError.message}`);
    }
    
    if (!records || records.length === 0) {
      console.log('⚠️ 记录不存在（可能已被删除）');
      return { success: false, reason: 'RECORD_NOT_FOUND' };
    }
    
    const record = records[0];
    console.log(`✅ 找到记录:`);
    console.log(`   ID: ${record.id}`);
    console.log(`   书名: ${record.book_title}`);
    console.log(`   图片URL: ${record.image_url ? '存在' : '无'}`);
    
    console.log('\n🗑️ 步骤2: 删除数据库记录...');
    
    // 删除数据库记录（15秒超时）
    const deleteResult = await withTimeout(
      supabase
        .from('illustrations_optimized')
        .delete()
        .eq('id', record.id),
      15000
    );
    
    const { error: deleteError } = deleteResult;
    
    if (deleteError) {
      throw new Error(`删除数据库记录失败: ${deleteError.message}`);
    }
    
    console.log('✅ 数据库记录删除成功');
    
    // 删除存储文件（如果存在）
    if (record.image_url) {
      try {
        console.log('\n🗂️ 步骤3: 删除存储文件...');
        
        const urlParts = record.image_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        console.log(`   存储文件名: ${fileName}`);
        
        const storageResult = await withTimeout(
          supabase.storage
            .from('illustrations')
            .remove([fileName]),
          15000
        );
        
        const { error: storageError } = storageResult;
        
        if (storageError) {
          console.log(`⚠️ 删除存储文件失败: ${storageError.message}`);
          console.log('💡 数据库记录已成功删除，存储文件可能需要手动清理');
        } else {
          console.log('✅ 存储文件删除成功');
        }
      } catch (storageError) {
        console.log(`⚠️ 删除存储文件时出错: ${storageError.message}`);
        console.log('💡 数据库记录已成功删除，存储文件可能需要手动清理');
      }
    } else {
      console.log('\n💡 该记录没有关联的存储文件');
    }
    
    console.log('\n🎉 单个记录删除完成');
    console.log('==========================================');
    console.log('✅ 数据库记录: 已删除');
    console.log('✅ 存储文件: ' + (record.image_url ? '已处理' : '无需处理'));
    
    return { success: true, recordId: record.id };
    
  } catch (error) {
    console.log(`\n❌ 删除失败: ${error.message}`);
    
    if (error.message.includes('超时')) {
      console.log('💡 建议: 检查网络连接或稍后重试');
    }
    
    return { success: false, error: error.message };
  }
}

// 主函数
async function main() {
  // 可以通过命令行参数指定文件名，或使用默认的超时文件
  const filename = process.argv[2] || '1272-《隐形叶子》.jpg';
  
  console.log(`🎯 准备删除文件: ${filename}`);
  
  if (process.argv[2]) {
    console.log('💡 使用命令行指定的文件名');
  } else {
    console.log('💡 使用默认的超时文件名');
  }
  
  console.log('');
  
  const result = await deleteSingleRecord(filename);
  
  if (result.success) {
    console.log(`\n🎉 成功删除记录: ${result.recordId}`);
    process.exit(0);
  } else {
    console.log(`\n❌ 删除失败: ${result.error || result.reason}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
