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

// 分页查询参数
export interface PaginationParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
}

// 分页查询结果
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 获取数据库记录（分页版本）
export async function fetchDatabaseRecordsPaginated(
  params: PaginationParams
): Promise<PaginatedResult<DatabaseRecord>> {
  const { supabase } = await import('../lib/supabase');
  
  const { page, pageSize, searchTerm } = params;
  const offset = (page - 1) * pageSize;
  
  // 构建查询
  let query = supabase
    .from('illustrations_optimized')
    .select('id, filename, book_title, ai_description, image_url, created_at, updated_at', { count: 'exact' });
  
  // 如果有搜索词，添加搜索条件
  if (searchTerm && searchTerm.trim()) {
    query = query.or(`filename.ilike.%${searchTerm}%,book_title.ilike.%${searchTerm}%,ai_description.ilike.%${searchTerm}%`);
  }
  
  // 添加分页和排序
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`获取数据库记录失败: ${error.message}`);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: data || [],
    total,
    page,
    pageSize,
    totalPages
  };
}

// 获取数据库记录（向后兼容）
export async function fetchDatabaseRecords(): Promise<DatabaseRecord[]> {
  const result = await fetchDatabaseRecordsPaginated({
    page: 1,
    pageSize: 100
  });
  return result.data;
}

// 获取数据库统计信息
export async function getDatabaseStats(): Promise<{
  total: number;
  recentCount: number; // 最近7天的记录数
}> {
  const { supabase } = await import('../lib/supabase');
  
  // 获取总记录数
  const { count: total, error: totalError } = await supabase
    .from('illustrations_optimized')
    .select('*', { count: 'exact', head: true });
  
  if (totalError) {
    throw new Error(`获取统计信息失败: ${totalError.message}`);
  }
  
  // 获取最近7天的记录数
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { count: recentCount, error: recentError } = await supabase
    .from('illustrations_optimized')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo.toISOString());
  
  if (recentError) {
    throw new Error(`获取最近记录统计失败: ${recentError.message}`);
  }
  
  return {
    total: total || 0,
    recentCount: recentCount || 0
  };
} 