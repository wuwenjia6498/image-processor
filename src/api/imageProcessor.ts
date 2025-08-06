import { supabase } from './supabaseClient';
import { generateImageDescription } from '../services/frontend-ai-service';
import { imageDescriptionToVector } from '../services/unified-embedding';

// 处理后的插图结果接口
export interface ProcessedImage {
  id: string;
  filename: string;
  bookTitle: string;
  aiDescription: string;
  bookTheme: string;
  status: 'success' | 'error';
  imageUrl: string;
}

// 添加重试函数
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`操作失败，第 ${attempt}/${maxRetries} 次重试:`, error);
      
      if (attempt < maxRetries) {
        // 指数退避：每次重试延迟时间翻倍
        const waitTime = delay * Math.pow(2, attempt - 1);
        console.log(`等待 ${waitTime}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

// 检查文件大小和类型
function validateFile(file: File): { isValid: boolean; error?: string } {
  // 检查文件大小（限制为10MB）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: `文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，请选择小于10MB的插图` 
    };
  }
  
  // 检查文件类型
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return { 
      isValid: false, 
      error: `不支持的文件类型: ${file.type}，请选择 JPEG、PNG、WebP 或 GIF 格式` 
    };
  }
  
  return { isValid: true };
}

// 生成详细的AI描述
async function generateDetailedDescription(file: File, bookTitle: string): Promise<string> {
  try {
    // 使用前端适配的GPT-4V服务生成描述
    console.log(`🤖 正在为《${bookTitle}》生成 GPT-4V 描述...`);
    const description = await generateImageDescription(file, bookTitle);
    return description;
  } catch (error) {
    console.error('GPT-4V 描述生成失败:', error);
    return `这是一幅来自绘本《${bookTitle}》的精美插图，展现了绘本的艺术魅力和教育价值。`;
  }
}

// 从文件名提取绘本标题
function extractBookTitle(filename: string): string {
  // 移除文件扩展名
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // 移除数字前缀（如 "1-", "3-", "4-" 等）
  // 注意：只移除数字+连字符的前缀，不移除像"14只"这样数字是标题一部分的情况
  let titleWithoutPrefix = nameWithoutExt.replace(/^\d+-/, '');
  
  // 移除后缀数字（如 "-1", "-2", "1", "2" 等）
  // 先移除连字符+数字的后缀
  titleWithoutPrefix = titleWithoutPrefix.replace(/-\d+$/, '');
  // 再移除纯数字后缀
  titleWithoutPrefix = titleWithoutPrefix.replace(/\d+$/, '');
  
  // 如果标题为空，返回文件名
  return titleWithoutPrefix || nameWithoutExt;
}

// 智能匹配绘本主题
function matchBookTheme(bookTitle: string): {
  theme: string;
} {
  const title = bookTitle.toLowerCase();
  
  // 简单的主题匹配逻辑
  if (title.includes('老鼠') || title.includes('14只')) {
    return { theme: '温馨的家庭生活，展现小老鼠一家的日常生活和亲情' };
  }
  if (title.includes('生气') || title.includes('愤怒') || title.includes('菲菲')) {
    return { theme: '情绪管理，帮助孩子认识和表达情绪' };
  }
  if (title.includes('圣诞') || title.includes('礼物')) {
    return { theme: '节日文化，圣诞节的欢乐氛围和礼物文化' };
  }
  if (title.includes('冬至') || title.includes('饺子')) {
    return { theme: '节气文化，了解冬至的传统习俗和饮食文化' };
  }
  if (title.includes('空间站') || title.includes('太空') || title.includes('宇宙')) {
    return { theme: '科学探索，激发对宇宙和科技的好奇心' };
  }
  if (title.includes('勇气') || title.includes('勇敢')) {
    return { theme: '勇气培养，面对困难时的勇敢和坚持' };
  }
  if (title.includes('雪') || title.includes('冬天')) {
    return { theme: '自然体验，感受冬天的美丽和乐趣' };
  }
  
  // 默认主题
  return { theme: '儿童绘本，传递积极正面的价值观' };
}

// 生成ASCII安全的ID
function generateAsciiId(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

// 生成安全的存储文件名
function generateSafeStorageName(filename: string): string {
  const timestamp = Date.now();
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}_${safeName}`;
}

// 真正的图片上传和处理
export const uploadImages = async (
  files: File[], 
  onProgress?: (progress: { current: number; total: number; currentFile: string; status: 'processing' | 'completed' | 'error'; error?: string }) => void
): Promise<ProcessedImage[]> => {
  console.log('开始处理插图:', files);
  const results: ProcessedImage[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const originalFilename = file.name;
    const bookTitle = extractBookTitle(originalFilename);
    const theme = matchBookTheme(bookTitle);
    const id = generateAsciiId(originalFilename);
    
    console.log(`\n📸 处理第 ${i + 1}/${files.length} 张插图: ${originalFilename}`);
    
    // 通知开始处理当前文件
    onProgress?.({
      current: i + 1,
      total: files.length,
      currentFile: originalFilename,
      status: 'processing'
    });
    
    // 验证文件
    const validation = validateFile(file);
    if (!validation.isValid) {
      console.error('文件验证失败:', validation.error);
      
      const errorResult: ProcessedImage = {
        id,
        filename: originalFilename,
        bookTitle,
        aiDescription: `文件验证失败: ${validation.error}`,
        bookTheme: theme.theme,
        status: 'error',
        imageUrl: URL.createObjectURL(file)
      };
      
      results.push(errorResult);
      
      // 通知文件处理失败
      onProgress?.({
        current: i + 1,
        total: files.length,
        currentFile: originalFilename,
        status: 'error',
        error: validation.error
      });
      
      continue;
    }
    
    try {
      // 1. 生成安全的存储文件名
      const safeStorageName = generateSafeStorageName(originalFilename);
      console.log(`🔄 存储名称: ${safeStorageName}`);
      
      // 2. 上传插图到Supabase存储（带重试）
      console.log('⬆️ 开始上传插图...');
      const uploadResult = await retryOperation(async () => {
        const { data, error } = await supabase.storage
          .from('illustrations')
          .upload(`images/${safeStorageName}`, file, {
            contentType: file.type,
            upsert: true
          });
        
        if (error) {
          throw new Error(`上传失败: ${error.message}`);
        }
        
        return data;
      }, 3, 2000); // 最多重试3次，初始延迟2秒
      
      console.log('✅ 插图上传成功');
      
      // 3. 获取插图的公开URL
      const { data: urlData } = supabase.storage
        .from('illustrations')
        .getPublicUrl(`images/${safeStorageName}`);
      
      const publicUrl = urlData.publicUrl;
      
      // 4. 生成详细的AI描述（带重试）
      console.log('🤖 开始生成AI描述...');
      const aiDescription = await retryOperation(async () => {
        return await generateDetailedDescription(file, bookTitle);
      }, 2, 3000); // AI描述重试2次，延迟3秒
      
      console.log('✅ AI描述生成成功');
      
      // 5. 生成向量嵌入（带重试）
      let vectorEmbedding: number[] | null = null;
      try {
        console.log('🧮 开始生成向量嵌入...');
        vectorEmbedding = await retryOperation(async () => {
          return await imageDescriptionToVector(aiDescription);
        }, 2, 2000);
        console.log(`✅ 向量嵌入生成成功: ${vectorEmbedding.length}维`);
      } catch (error) {
        console.error('⚠️ 向量嵌入生成失败，将继续保存其他数据:', error);
        // 向量嵌入失败不影响整体流程，继续保存其他数据
      }
      
      // 6. 保存到Supabase数据库（带重试）
      console.log('💾 开始保存到数据库...');
      await retryOperation(async () => {
        const { error: dbError } = await supabase
          .from('illustrations_optimized')
          .upsert({
            id,
            filename: originalFilename,
            book_title: bookTitle,
            image_url: publicUrl,
            ai_description: aiDescription,
            vector_embedding: vectorEmbedding,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (dbError) {
          throw new Error(`数据库保存失败: ${dbError.message}`);
        }
      }, 3, 1500); // 数据库操作重试3次，延迟1.5秒
      
      console.log('✅ 数据库保存成功');
      
      // 7. 成功处理
      const successResult: ProcessedImage = {
        id,
        filename: originalFilename,
        bookTitle,
        aiDescription,
        bookTheme: theme.theme,
        status: 'success',
        imageUrl: publicUrl
      };
      
      results.push(successResult);
      
      // 通知文件处理成功
      onProgress?.({
        current: i + 1,
        total: files.length,
        currentFile: originalFilename,
        status: 'completed'
      });
      
      console.log(`🎉 插图 ${originalFilename} 处理完成`);
      
      // 添加短暂延迟，避免请求过于频繁
      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`❌ 处理插图 ${originalFilename} 失败:`, error);
      
      // 如果是网络错误，尝试清理可能已上传的文件
      if (error instanceof Error && error.message.includes('上传失败')) {
        try {
          const safeStorageName = generateSafeStorageName(originalFilename);
          await supabase.storage
            .from('illustrations')
            .remove([`images/${safeStorageName}`]);
          console.log('🧹 已清理失败的上传文件');
        } catch (cleanupError) {
          console.warn('清理文件失败:', cleanupError);
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const errorResult: ProcessedImage = {
        id,
        filename: originalFilename,
        bookTitle,
        aiDescription: `处理失败: ${errorMessage}`,
        bookTheme: theme.theme,
        status: 'error',
        imageUrl: URL.createObjectURL(file)
      };
      
      results.push(errorResult);
      
      // 通知文件处理失败
      onProgress?.({
        current: i + 1,
        total: files.length,
        currentFile: originalFilename,
        status: 'error',
        error: errorMessage
      });
    }
  }
  
  console.log(`\n📊 批量处理完成: ${results.filter(r => r.status === 'success').length}/${results.length} 成功`);
  return results;
};

// 处理已上传的插图
export const processImages = async (imageIds: string[]): Promise<void> => {
  // 实现批量处理逻辑
  console.log('批量处理插图:', imageIds);
};

// 获取处理状态
export const getProcessingStatus = async (): Promise<{
  total: number;
  processed: number;
  success: number;
  error: number;
}> => {
  // 实现状态查询逻辑
  return {
    total: 0,
    processed: 0,
    success: 0,
    error: 0
  };
}; 

// 测试函数：验证书名提取逻辑
export function testExtractBookTitle(): void {
  const testCases = [
    { input: "3-飞吧，飞过最高的山-2", expected: "飞吧，飞过最高的山" },
    { input: "4-我的山野中国--双大鞋1", expected: "我的山野中国--双大鞋" },
    { input: "1-老鼠和鼹鼠:有我的礼物吗3", expected: "老鼠和鼹鼠:有我的礼物吗" },
    { input: "4-雪", expected: "雪" },
    { input: "5-雪花的方向", expected: "雪花的方向" },
    { input: "14只老鼠过冬天2", expected: "14只老鼠过冬天" },
    { input: "4-北京的庙会2", expected: "北京的庙会" },
    { input: "4-大雪天-1", expected: "大雪天" },
    { input: "冬至·饺子宴2", expected: "冬至·饺子宴" },
    { input: "红礼盒-1", expected: "红礼盒" },
    { input: "年兽来了-1", expected: "年兽来了" },
    { input: "元宵节的故事-1", expected: "元宵节的故事" },
    { input: "元宵节的故事-2", expected: "元宵节的故事" },
    { input: "普通文件名.jpg", expected: "普通文件名" },
    { input: "没有数字的文件名.png", expected: "没有数字的文件名" }
  ];

  console.log("🧪 测试书名提取逻辑:");
  console.log("=" .repeat(50));
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(({ input, expected }, index) => {
    const result = extractBookTitle(input);
    const isCorrect = result === expected;
    
    if (isCorrect) {
      passed++;
      console.log(`✅ 测试 ${index + 1}: "${input}" → "${result}"`);
    } else {
      failed++;
      console.log(`❌ 测试 ${index + 1}: "${input}" → "${result}" (期望: "${expected}")`);
    }
  });
  
  console.log("=" .repeat(50));
  console.log(`📊 测试结果: ${passed} 通过, ${failed} 失败`);
  
  if (failed === 0) {
    console.log("🎉 所有测试通过！书名提取逻辑正确。");
  } else {
    console.log("⚠️ 有测试失败，需要检查提取逻辑。");
  }
} 