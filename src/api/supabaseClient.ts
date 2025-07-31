import { createClient } from '@supabase/supabase-js';

// 直接使用配置的Supabase信息
const supabaseUrl = 'https://ixdlwnzktpkhwaxeddzh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZGx3bnprdHBraHdheGVkZHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzQyNDY0MiwiZXhwIjoyMDY5MDAwNjQyfQ.wJUDcntT_JNTE2heAHLsIddo-_UDkhQ5_Q1Zvk5JeiQ';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface DatabaseRecord {
  id: string;
  filename: string;
  book_title: string;
  ai_description: string;
  age_orientation: string;
  text_type_fit: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export const fetchDatabaseRecords = async (): Promise<DatabaseRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('illustrations_optimized')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('获取数据库记录失败:', error);
    throw error;
  }
}; 