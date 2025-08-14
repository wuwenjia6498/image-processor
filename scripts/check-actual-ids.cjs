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

// 检查数据库中实际的ID格式
async function checkActualIds() {
  console.log('🔍 检查数据库中实际的ID格式');
  console.log('==========================================');
  
  try {
    // 获取一些示例记录来查看ID格式
    const { data: records, error } = await supabase
      .from('illustrations_optimized')
      .select('id, filename, book_title')
      .limit(20)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ 查询失败:', error.message);
      return;
    }
    
    if (!records || records.length === 0) {
      console.log('⚠️ 数据库中没有找到任何记录');
      return;
    }
    
    console.log(`📊 找到 ${records.length} 条记录，显示ID格式:`);
    console.log('');
    
    records.forEach((record, index) => {
      console.log(`${index + 1}. ID: "${record.id}"`);
      console.log(`   文件名: "${record.filename}"`);
      console.log(`   书名: "${record.book_title}"`);
      console.log('');
    });
    
    // 特别查找包含我们要删除的文件名的记录
    console.log('🔍 查找包含目标文件名的记录:');
    console.log('==========================================');
    
    const targetFilenames = [
      "1499-假如再给我三天时间.jpg",
      "1233-只老鼠_1.jpg", 
      "1232-只老鼠.jpg",
      "1235-只老鼠去春游_1.jpg",
      "1239-男孩向前冲.jpg"
    ];
    
    for (const filename of targetFilenames) {
      const { data: matchingRecords, error: searchError } = await supabase
        .from('illustrations_optimized')
        .select('id, filename, book_title')
        .ilike('filename', `%${filename}%`);
      
      if (searchError) {
        console.log(`❌ 搜索 ${filename} 失败: ${searchError.message}`);
        continue;
      }
      
      if (matchingRecords && matchingRecords.length > 0) {
        console.log(`✅ 找到匹配 "${filename}" 的记录:`);
        matchingRecords.forEach(record => {
          console.log(`   ID: "${record.id}"`);
          console.log(`   文件名: "${record.filename}"`);
          console.log(`   书名: "${record.book_title}"`);
        });
      } else {
        console.log(`❌ 未找到匹配 "${filename}" 的记录`);
      }
      console.log('');
    }
    
    // 获取总记录数
    const { count, error: countError } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`⚠️ 获取总记录数失败: ${countError.message}`);
    } else {
      console.log(`📊 数据库总记录数: ${count}`);
    }
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  }
}

// 主函数
async function main() {
  await checkActualIds();
}

if (require.main === module) {
  main();
}
