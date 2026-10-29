const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listFilesDetail() {
  const { data, error } = await supabase.storage.from('products').list('a5267c80-dd56-4059-8d59-c66285139679', { limit: 100 });
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Found ${data.length} files in products/a5267c80-dd56-4059-8d59-c66285139679:`);
  data.forEach(f => console.log(' -', f.name, '| created:', f.created_at));
}

listFilesDetail();
