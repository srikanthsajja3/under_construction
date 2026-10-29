const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixImageMismatch() {
  console.log('Connecting to Supabase at:', supabaseUrl);

  // 1. Get all files in products/a5267c80-dd56-4059-8d59-c66285139679
  const vendorFolder = 'a5267c80-dd56-4059-8d59-c66285139679';
  const { data: storageFiles, error: storageErr } = await supabase.storage
    .from('products')
    .list(vendorFolder, { limit: 500 });

  if (storageErr) {
    console.error('Error fetching storage files:', storageErr);
    return;
  }

  const validFiles = (storageFiles || []).filter(f => f.name.endsWith('.jpg') || f.name.endsWith('.png') || f.name.endsWith('.jpeg'));
  console.log(`Found ${validFiles.length} actual image files in storage folder 'products/${vendorFolder}/'.`);

  // 2. Fetch items from database
  const { data: dbItems, error: dbErr } = await supabase
    .from('items')
    .select('id, name, sku, label_no, image_url')
    .order('created_at', { ascending: true });

  if (dbErr) {
    console.error('Error fetching items from database:', dbErr);
    return;
  }

  console.log(`Found ${dbItems.length} items in database.`);

  // 3. Pair existing files in storage with items in DB
  let updatedCount = 0;
  const totalPairs = Math.min(validFiles.length, dbItems.length);

  for (let i = 0; i < totalPairs; i++) {
    const item = dbItems[i];
    const file = validFiles[i];

    const skuOrLabel = (item.sku || item.label_no || `ITEM_${i + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const oldFilePath = `${vendorFolder}/${file.name}`;
    const newFilePath = `items/${skuOrLabel}_1.jpg`;

    const oldPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${oldFilePath}`;
    const newPublicUrl = `${supabaseUrl}/storage/v1/object/public/products/${newFilePath}`;

    console.log(`\nItem [${i + 1}/${totalPairs}]: "${item.name}" (SKU: ${item.sku || item.label_no})`);
    console.log(`   Storage File: ${oldFilePath}`);
    console.log(`   New Named Target: ${newFilePath}`);

    // Try moving/copying file in 'products' bucket to clean SKU name
    const { error: moveErr } = await supabase.storage
      .from('products')
      .copy(oldFilePath, newFilePath);

    let finalUrl = oldPublicUrl;
    if (moveErr) {
      console.log(`   Notice (copy): ${moveErr.message}. Using existing file path.`);
    } else {
      console.log(`   [COPIED] Created clean SKU image: ${newFilePath}`);
      finalUrl = newPublicUrl;
    }

    // Update database record
    const { error: updateErr } = await supabase
      .from('items')
      .update({
        image_url: finalUrl,
        image_urls: [finalUrl],
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    if (updateErr) {
      console.error(`   Error updating DB: ${updateErr.message}`);
    } else {
      console.log(`   [SUCCESS DB UPDATE] -> ${finalUrl}`);
      updatedCount++;
    }
  }

  console.log(`\nFinished! Successfully synced ${updatedCount} DB items with actual Storage images.`);
}

fixImageMismatch().catch(err => console.error(err));
