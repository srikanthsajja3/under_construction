const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
require('dotenv').config();

const csvPath = 'C:\\Users\\srika\\Downloads\\items_rows (20).csv';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreUrlsFromCsv() {
  console.log('Reading CSV from:', csvPath);
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`Parsed ${parsed.data.length} rows from CSV.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of parsed.data) {
    const id = row.id;
    const sku = row.sku || row.label_no;

    // Check if CSV has image_url or image_urls
    let imageUrl = row.image_url;
    let imageUrls = row.image_urls;
    let thumbnailUrl = row.thumbnail_url;
    let thumbnailUrls = row.thumbnail_urls;

    if (!imageUrl && (!imageUrls || imageUrls === '[]')) {
      skippedCount++;
      continue;
    }

    // Convert domain if needed from old supabase host to current supabase host
    if (imageUrl) {
      imageUrl = imageUrl.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, supabaseUrl);
    }

    let parsedImageUrls = [];
    if (imageUrls && imageUrls !== '[]') {
      try {
        parsedImageUrls = JSON.parse(imageUrls).map(u => u.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, supabaseUrl));
      } catch (e) {
        if (imageUrl) parsedImageUrls = [imageUrl];
      }
    } else if (imageUrl) {
      parsedImageUrls = [imageUrl];
    }

    let parsedThumbUrls = [];
    if (thumbnailUrls && thumbnailUrls !== '[]') {
      try {
        parsedThumbUrls = JSON.parse(thumbnailUrls).map(u => u.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, supabaseUrl));
      } catch (e) {}
    }

    if (thumbnailUrl) {
      thumbnailUrl = thumbnailUrl.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, supabaseUrl);
    }

    // Update DB record by id or sku
    let query = supabase.from('items').update({
      image_url: imageUrl || (parsedImageUrls.length > 0 ? parsedImageUrls[0] : null),
      image_urls: parsedImageUrls,
      thumbnail_url: thumbnailUrl || null,
      thumbnail_urls: parsedThumbUrls,
      updated_at: new Date().toISOString()
    });

    if (id) {
      query = query.eq('id', id);
    } else if (sku) {
      query = query.eq('sku', sku);
    } else {
      skippedCount++;
      continue;
    }

    const { error } = await query;

    if (error) {
      console.error(`Failed to update item ${sku || id}:`, error.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`\nFinished restoring URLs from CSV!`);
  console.log(`Successfully updated: ${updatedCount} items.`);
  console.log(`Skipped (no image data): ${skippedCount} items.`);
}

restoreUrlsFromCsv().catch(err => console.error(err));
