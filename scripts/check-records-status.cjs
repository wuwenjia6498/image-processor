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

// 从批量上传报告中成功处理的文件列表（前10个作为样本检查）
const sampleFiles = [
  "1499-假如再给我三天时间.jpg",
  "1233-只老鼠_1.jpg",
  "1232-只老鼠.jpg",
  "1235-只老鼠去春游_1.jpg",
  "1239-男孩向前冲.jpg",
  "1238-只小猪和100只狼_1.jpg",
  "1237-只小猪和100只狼.jpg",
  "1236-只老鼠去春游_2.jpg",
  "1231-岁的鱼.jpg",
  "1240-Brush, Brush, Brush!.jpg"
];

// 将文件名转换为数据库ID（去除扩展名）
function filenameToId(filename) {
  return filename.replace('.jpg', '');
}

// 检查记录状态
async function checkRecordsStatus() {
  console.log('🔍 检查数据库记录状态');
  console.log('==========================================');
  
  for (const filename of sampleFiles) {
    const id = filenameToId(filename);
    
    try {
      const { data: record, error } = await supabase
        .from('illustrations_optimized')
        .select('id, filename, book_title, created_at')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ ${filename} (ID: ${id}) - 记录不存在`);
        } else {
          console.log(`⚠️ ${filename} (ID: ${id}) - 查询错误: ${error.message}`);
        }
      } else {
        console.log(`✅ ${filename} (ID: ${id}) - 记录存在`);
        console.log(`   书名: ${record.book_title}`);
        console.log(`   创建时间: ${record.created_at}`);
      }
    } catch (error) {
      console.log(`❌ ${filename} (ID: ${id}) - 查询失败: ${error.message}`);
    }
  }
  
  // 检查总记录数
  try {
    const { count, error } = await supabase
      .from('illustrations_optimized')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`\n⚠️ 获取总记录数失败: ${error.message}`);
    } else {
      console.log(`\n📊 数据库总记录数: ${count}`);
    }
  } catch (error) {
    console.log(`\n❌ 查询总记录数时出错: ${error.message}`);
  }
}

// 主函数
async function main() {
  try {
    await checkRecordsStatus();
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
