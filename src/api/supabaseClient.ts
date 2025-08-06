// 重新导出统一的Supabase客户端
export { supabase, getSupabaseClient } from '../lib/supabase';

// 数据库记录接口
export interface DatabaseRecord {
  id: string;
  filename: string;
  book_title: string;
  ai_description: string;
  image_url?: string;
  vector_embedding?: number[];
  created_at: string;
  updated_at?: string;
}

// 获取数据库记录
export async function fetchDatabaseRecords(): Promise<DatabaseRecord[]> {
  const { supabase } = await import('../lib/supabase');
  
  const { data, error } = await supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`获取数据库记录失败: ${error.message}`);
  }

  return data || [];
} 