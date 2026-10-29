const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const csvPath = 'C:\\Users\\srika\\Downloads\\items_rows (20).csv';
const outputSqlPath = 'C:\\Users\\srika\\development\\my-new-app\\restore_items_urls.sql';

console.log('Reading CSV from:', csvPath);
const csvContent = fs.readFileSync(csvPath, 'utf8');

const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true
});

console.log(`Parsed ${parsed.data.length} rows from CSV.`);

let sqlStatements = [
  '-- SQL Restoration Script generated from items_rows (20).csv',
  '-- Run this script in Supabase SQL Editor to restore exact image_url, image_urls, thumbnail_url, and thumbnail_urls',
  'BEGIN;\n'
];

let count = 0;

for (const row of parsed.data) {
  const id = row.id;
  const sku = row.sku || row.label_no;

  let imageUrl = row.image_url || '';
  let imageUrls = row.image_urls || '[]';
  let thumbnailUrl = row.thumbnail_url || '';
  let thumbnailUrls = row.thumbnail_urls || '[]';

  if (!imageUrl && imageUrls === '[]') {
    continue;
  }

  // Helper function to escape single quotes in SQL strings
  const escapeSql = (str) => str ? str.replace(/'/g, "''") : '';

  // Handle image_urls array format for SQL
  let formattedImageUrls = "'{}'::text[]";
  if (imageUrls && imageUrls !== '[]') {
    try {
      const arr = JSON.parse(imageUrls);
      if (Array.isArray(arr) && arr.length > 0) {
        const escapedElements = arr.map(u => `'${escapeSql(u)}'`);
        formattedImageUrls = `ARRAY[${escapedElements.join(', ')}]::text[]`;
      }
    } catch (e) {
      if (imageUrl) {
        formattedImageUrls = `ARRAY['${escapeSql(imageUrl)}']::text[]`;
      }
    }
  } else if (imageUrl) {
    formattedImageUrls = `ARRAY['${escapeSql(imageUrl)}']::text[]`;
  }

  // Handle thumbnail_urls array format for SQL
  let formattedThumbUrls = "'{}'::text[]";
  if (thumbnailUrls && thumbnailUrls !== '[]') {
    try {
      const arr = JSON.parse(thumbnailUrls);
      if (Array.isArray(arr) && arr.length > 0) {
        const escapedElements = arr.map(u => `'${escapeSql(u)}'`);
        formattedThumbUrls = `ARRAY[${escapedElements.join(', ')}]::text[]`;
      }
    } catch (e) {}
  }

  const sqlImgUrl = imageUrl ? `'${escapeSql(imageUrl)}'` : 'NULL';
  const sqlThumbUrl = thumbnailUrl ? `'${escapeSql(thumbnailUrl)}'` : 'NULL';

  let whereClause = '';
  if (id) {
    whereClause = `id = '${escapeSql(id)}'`;
  } else if (sku) {
    whereClause = `sku = '${escapeSql(sku)}'`;
  } else {
    continue;
  }

  const statement = `UPDATE public.items SET image_url = ${sqlImgUrl}, image_urls = ${formattedImageUrls}, thumbnail_url = ${sqlThumbUrl}, thumbnail_urls = ${formattedThumbUrls}, updated_at = NOW() WHERE ${whereClause};`;
  
  sqlStatements.push(statement);
  count++;
}

sqlStatements.push('\nCOMMIT;');

fs.writeFileSync(outputSqlPath, sqlStatements.join('\n'), 'utf8');
console.log(`\nSuccessfully generated ${count} UPDATE statements into '${outputSqlPath}'.`);
