import { supabase } from '../lib/supabase';

export interface DownloadedIllustration {
  id: string;
  filename: string;
  book_title?: string;
  image_url: string;
  original_description?: string;
  download_date: string;
  download_count: number;
  last_used_date: string;
  tags: string[];
  category: string;
  file_size?: number;
  file_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface DownloadLibraryStats {
  total_materials: number;
}

// 记录图片下载
export async function recordImageDownload(
  filename: string,
  imageUrl: string,
  bookTitle?: string,
  originalDescription?: string,
  category: string = '未分类',
  tags: string[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    // 检查是否已存在该图片
    const { data: existing, error: checkError } = await supabase
      .from('material_library')
      .select('*')
      .eq('filename', filename)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existing) {
      // 如果已存在，更新下载次数和最后使用时间
      const { error: updateError } = await supabase
        .from('material_library')
        .update({
          download_count: existing.download_count + 1,
          last_used_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      // 如果不存在，创建新记录
      const { error: insertError } = await supabase
        .from('material_library')
        .insert({
          filename,
          book_title: bookTitle,
          image_url: imageUrl,
          original_description: originalDescription,
          download_date: new Date().toISOString(),
          download_count: 1,
          last_used_date: new Date().toISOString(),
          tags,
          category,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) throw insertError;
    }

    return { success: true };
  } catch (error) {
    console.error('记录图片下载失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

// 获取下载库中的所有图片
export async function getDownloadedIllustrations(
  limit: number = 50,
  offset: number = 0,
  category?: string, // 保留参数以兼容现有调用，但不使用
  searchQuery?: string
): Promise<{ data: DownloadedIllustration[]; error?: string; total?: number }> {
  try {
    let query = supabase
      .from('material_library')
      .select('*', { count: 'exact' });

    // 添加搜索过滤
    if (searchQuery && searchQuery.trim()) {
      query = query.or(`filename.ilike.%${searchQuery}%,original_description.ilike.%${searchQuery}%`);
    }

    // 添加分页和排序
    const { data, error, count } = await query
      .order('last_used_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { 
      data: data || [], 
      total: count || 0 
    };
  } catch (error) {
    console.error('获取下载图片失败:', error);
    return { 
      data: [], 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

// 检查图片是否已下载
export async function checkIfImageDownloaded(filename: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('material_library')
      .select('id')
      .eq('filename', filename)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('检查图片下载状态失败:', error);
    return false;
  }
}

// 批量检查多个图片是否已下载
export async function checkMultipleImagesDownloaded(filenames: string[]): Promise<Set<string>> {
  try {
    if (filenames.length === 0) return new Set();

    const { data, error } = await supabase
      .from('material_library')
      .select('filename')
      .in('filename', filenames);

    if (error) throw error;

    return new Set(data?.map(item => item.filename) || []);
  } catch (error) {
    console.error('批量检查图片下载状态失败:', error);
    return new Set();
  }
}

// 获取下载库统计信息
export async function getDownloadLibraryStats(): Promise<{ data?: DownloadLibraryStats; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_material_library_stats');

    if (error) throw error;

    return { data };
  } catch (error) {
    console.error('获取下载库统计失败:', error);
    return { 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

// 删除下载记录
export async function deleteDownloadedIllustration(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('material_library')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('删除下载记录失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

// 更新图片分类
export async function updateImageCategory(id: string, category: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('material_library')
      .update({ 
        category,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('更新图片分类失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

// 更新图片标签
export async function updateImageTags(id: string, tags: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('material_library')
      .update({ 
        tags,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('更新图片标签失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
} 