const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProductsTable() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, product_code, image_url, image')
    .limit(10);

  if (error) {
    console.log('Error querying products table:', error.message);
  } else {
    console.log(`Found ${products ? products.length : 0} in 'products' table:`);
    products.forEach(p => console.log('Product:', p));
  }
}

checkProductsTable();
