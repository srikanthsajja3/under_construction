const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStorage() {
  const buckets = ['item-images', 'products'];
  for (const b of buckets) {
    const { data, error } = await supabase.storage.from(b).list('');
    console.log(`Bucket '${b}' list result:`, error ? error.message : `Found ${data.length} files/folders`);
    if (data && data.length > 0) {
      console.log(`First few files in '${b}':`, data.slice(0, 5));
    }
  }
}

testStorage();
