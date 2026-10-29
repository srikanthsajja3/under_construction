const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectAndRename() {
  console.log('Connecting to Supabase at:', supabaseUrl);
  
  // 1. Fetch items from DB
  const { data: items, error } = await supabase
    .from('items')
    .select('id, name, sku, label_no, image_url, image_urls');

  if (error) {
    console.error('Error fetching items from database:', error);
    return;
  }

  console.log(`Found ${items ? items.length : 0} items in database.`);

  let renamedCount = 0;
  let skippedCount = 0;

  for (const item of items || []) {
    const targetName = (item.sku || item.label_no || '').trim();
    if (!targetName) {
      console.log(`[SKIP] Item ID ${item.id} (${item.name}) has no SKU or label_no.`);
      skippedCount++;
      continue;
    }

    // Collect all image URLs (main + image_urls array)
    const allUrls = [];
    if (item.image_url) allUrls.push(item.image_url);
    if (Array.isArray(item.image_urls)) {
      for (const url of item.image_urls) {
        if (url && !allUrls.includes(url)) {
          allUrls.push(url);
        }
      }
    }

    if (allUrls.length === 0) {
      skippedCount++;
      continue;
    }

    const cleanTargetName = targetName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const updatedUrls = [];

    for (let i = 0; i < allUrls.length; i++) {
      const currentUrl = allUrls[i];
      const match = currentUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      
      if (!match) {
        updatedUrls.push(currentUrl);
        continue;
      }

      const bucketName = match[1];
      const oldFilePath = match[2];

      const extMatch = oldFilePath.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';

      const lastSlash = oldFilePath.lastIndexOf('/');
      const dirPrefix = lastSlash !== -1 ? oldFilePath.substring(0, lastSlash + 1) : '';

      // If item has multiple images: append index suffix (_1, _2, etc.)
      const suffix = allUrls.length > 1 ? `_${i + 1}` : '_1';
      const newFilePath = `${dirPrefix}${cleanTargetName}${suffix}.${ext}`;
      const newPublicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${newFilePath}`;

      if (oldFilePath !== newFilePath) {
        console.log(`[RENAMING ${i + 1}/${allUrls.length}] Item "${item.name}" (SKU: ${targetName})`);
        console.log(`   Old: ${bucketName}/${oldFilePath}`);
        console.log(`   New: ${bucketName}/${newFilePath}`);

        const { error: moveErr } = await supabase.storage
          .from(bucketName)
          .move(oldFilePath, newFilePath);

        if (moveErr) {
          console.error(`   Move failed: ${moveErr.message}`);
        } else {
          console.log(`   [SUCCESS] Renamed in storage`);
          renamedCount++;
        }
      }

      updatedUrls.push(newPublicUrl);
    }

    // Update DB record with updated primary image_url and image_urls array
    if (updatedUrls.length > 0) {
      const mainImageUrl = updatedUrls[0];
      const { error: updateErr } = await supabase
        .from('items')
        .update({
          image_url: mainImageUrl,
          image_urls: updatedUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`   Failed to update DB for item ${item.id}: ${updateErr.message}`);
      }
    }
  }

  console.log(`\nDone! Processed images for all items.`);
}

inspectAndRename().catch(err => console.error(err));
