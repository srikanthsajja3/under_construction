const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDbImageUrls() {
  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, sku, label_no, image_url')
    .limit(20);

  if (error) {
    console.error('DB fetch error:', error);
    return;
  }

  console.log('Sample DB image_url entries:');
  items.forEach(i => {
    console.log(`SKU: ${i.sku || i.label_no} | Name: ${i.name} | image_url: ${i.image_url}`);
  });
}

inspectDbImageUrls();
