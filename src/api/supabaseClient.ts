// 重新导出统一的Supabase客户端
export { supabase, getSupabaseClient } from '../lib/supabase';

// 数据库记录接口
export interface DatabaseRecord {
  id: string;
  filename: string;
  book_title: string;
  original_description: string;
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
    .select('id, filename, book_title, original_description, image_url, created_at, updated_at', { count: 'exact' });
  
  // 如果有搜索词，添加搜索条件
  if (searchTerm && searchTerm.trim()) {
    query = query.or(`filename.ilike.%${searchTerm}%,book_title.ilike.%${searchTerm}%,original_description.ilike.%${searchTerm}%`);
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

// 删除数据库记录
export async function deleteDatabaseRecord(id: string): Promise<void> {
  const { supabase } = await import('../lib/supabase');
  
  // 首先获取记录信息，以便删除对应的图片文件
  const { data: record, error: fetchError } = await supabase
    .from('illustrations_optimized')
    .select('filename, image_url')
    .eq('id', id)
    .single();
  
  if (fetchError) {
    throw new Error(`获取记录信息失败: ${fetchError.message}`);
  }
  
  // 删除数据库记录
  const { error: deleteError } = await supabase
    .from('illustrations_optimized')
    .delete()
    .eq('id', id);
  
  if (deleteError) {
    throw new Error(`删除数据库记录失败: ${deleteError.message}`);
  }
  
  // 如果存在图片URL，尝试删除存储中的图片文件
  if (record?.image_url) {
    try {
      // 从URL中提取文件路径
      const urlParts = record.image_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      // 删除存储中的图片文件
      const { error: storageError } = await supabase.storage
        .from('illustrations')
        .remove([fileName]);
      
      if (storageError) {
        console.warn('删除存储文件失败:', storageError);
        // 不抛出错误，因为数据库记录已经删除成功
      }
    } catch (storageError) {
      console.warn('删除存储文件时出错:', storageError);
      // 不抛出错误，因为数据库记录已经删除成功
    }
  }
} 