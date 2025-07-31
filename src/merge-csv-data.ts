import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

// CSV行的类型定义
interface CSVRow {
  filename: string;
  book_title: string;
  style_tags: string;
  mood_tags: string;
  composition_tags: string;
  scene_tags: string;
  season_tags: string;
  content_tags: string;
  emotion_tags: string;
  theme_tags: string;
  text_type_fit: string;
  age_orientation: string;
  tone_tags: string;
  book_theme_summary: string;
  book_keywords: string;
}

async function readCSV(filePath: string): Promise<CSVRow[]> {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return [];
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  return new Promise((resolve, reject) => {
    parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records as CSVRow[]);
      }
    });
  });
}

function writeCSV(filePath: string, data: CSVRow[]): void {
  const headers = [
    'filename',
    'book_title', 
    'style_tags',
    'mood_tags',
    'composition_tags',
    'scene_tags',
    'season_tags',
    'content_tags',
    'emotion_tags',
    'theme_tags',
    'text_type_fit',
    'age_orientation',
    'tone_tags',
    'book_theme_summary',
    'book_keywords'
  ];
  
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => `"${(row[header as keyof CSVRow] || '').replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  fs.writeFileSync(filePath, csvContent, 'utf8');
}

async function mergeCSVData() {
  console.log('🔄 合并CSV数据');
  console.log('===============\n');
  
  const originalPath = path.join(process.cwd(), 'data', 'metadata.csv');
  const newPath = path.join(process.cwd(), 'data', 'all_images_metadata.csv');
  const mergedPath = path.join(process.cwd(), 'data', 'merged_metadata.csv');
  
  try {
    // 读取原有数据
    console.log('📖 读取原有元数据...');
    const originalData = await readCSV(originalPath);
    console.log(`✓ 原有数据: ${originalData.length} 条记录`);
    
    // 读取新生成的数据
    console.log('📖 读取新生成的数据...');
    const newData = await readCSV(newPath);
    console.log(`✓ 新数据: ${newData.length} 条记录`);
    
    // 合并数据，避免重复
    console.log('🔄 合并数据...');
    const mergedData: CSVRow[] = [];
    const existingFiles = new Set<string>();
    
    // 首先添加原有数据（优先保留原有的详细标注）
    for (const row of originalData) {
      mergedData.push(row);
      existingFiles.add(row.filename);
    }
    
    // 然后添加新数据（跳过已存在的文件）
    let newCount = 0;
    for (const row of newData) {
      if (!existingFiles.has(row.filename)) {
        mergedData.push(row);
        existingFiles.add(row.filename);
        newCount++;
      }
    }
    
    console.log(`✓ 合并完成:`);
    console.log(`   原有记录: ${originalData.length}`);
    console.log(`   新增记录: ${newCount}`);
    console.log(`   总记录数: ${mergedData.length}`);
    
    // 按文件名排序
    mergedData.sort((a, b) => a.filename.localeCompare(b.filename));
    
    // 写入合并后的文件
    console.log('\n💾 保存合并后的数据...');
    writeCSV(mergedPath, mergedData);
    console.log(`✓ 合并文件已保存: ${mergedPath}`);
    
    // 备份原文件并替换
    if (fs.existsSync(originalPath)) {
      const backupPath = path.join(process.cwd(), 'data', `metadata_backup_${Date.now()}.csv`);
      fs.copyFileSync(originalPath, backupPath);
      console.log(`✓ 原文件已备份: ${backupPath}`);
    }
    
    // 将合并后的文件复制为主文件
    fs.copyFileSync(mergedPath, originalPath);
    console.log(`✓ 主元数据文件已更新: ${originalPath}`);
    
    // 统计信息
    console.log('\n📊 数据统计:');
    
    // 按绘本分组统计
    const bookGroups: { [key: string]: number } = {};
    const taggedCount = mergedData.filter(row => row.style_tags !== '待标注').length;
    
    mergedData.forEach(row => {
      bookGroups[row.book_title] = (bookGroups[row.book_title] || 0) + 1;
    });
    
    console.log(`   总图片数: ${mergedData.length}`);
    console.log(`   绘本数量: ${Object.keys(bookGroups).length}`);
    console.log(`   已标注图片: ${taggedCount}`);
    console.log(`   待标注图片: ${mergedData.length - taggedCount}`);
    
    // 显示绘本分布
    console.log('\n📚 绘本分布 (前10名):');
    const sortedBooks = Object.entries(bookGroups)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
      
    sortedBooks.forEach(([book, count], index) => {
      console.log(`   ${index + 1}. 《${book}》: ${count}张`);
    });
    
    console.log('\n✅ 数据合并完成！');
    console.log('\n💡 建议:');
    console.log('   1. 检查合并后的数据: data/metadata.csv');
    console.log('   2. 手动完善"待标注"和"待补充"的字段');
    console.log('   3. 运行 npm run verify 验证系统状态');
    
  } catch (error) {
    console.error('❌ 合并过程中出现错误:', error);
    process.exit(1);
  }
}

// 运行合并程序
mergeCSVData().catch(error => {
  console.error('❌ 合并过程中发生严重错误:', error);
  process.exit(1);
}); 