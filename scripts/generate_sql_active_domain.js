const fs = require('fs');
const Papa = require('papaparse');

const csvPath = 'C:\\Users\\srika\\Downloads\\items_rows (20).csv';
const outputSqlPath = 'C:\\Users\\srika\\development\\my-new-app\\restore_items_urls_active_domain.sql';
const activeDomain = 'https://tnvdmftovccgfrllaffq.supabase.co';

const csvContent = fs.readFileSync(csvPath, 'utf8');

const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true
});

let sqlStatements = [
  '-- SQL Restoration Script with Active Supabase Domain',
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

  if (!imageUrl && imageUrls === '[]') continue;

  imageUrl = imageUrl.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, activeDomain);
  thumbnailUrl = thumbnailUrl.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, activeDomain);

  const escapeSql = (str) => str ? str.replace(/'/g, "''") : '';

  let formattedImageUrls = "'{}'::text[]";
  if (imageUrls && imageUrls !== '[]') {
    try {
      const arr = JSON.parse(imageUrls);
      if (Array.isArray(arr) && arr.length > 0) {
        const escapedElements = arr.map(u => `'${escapeSql(u.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, activeDomain))}'`);
        formattedImageUrls = `ARRAY[${escapedElements.join(', ')}]::text[]`;
      }
    } catch (e) {
      if (imageUrl) formattedImageUrls = `ARRAY['${escapeSql(imageUrl)}']::text[]`;
    }
  } else if (imageUrl) {
    formattedImageUrls = `ARRAY['${escapeSql(imageUrl)}']::text[]`;
  }

  let formattedThumbUrls = "'{}'::text[]";
  if (thumbnailUrls && thumbnailUrls !== '[]') {
    try {
      const arr = JSON.parse(thumbnailUrls);
      if (Array.isArray(arr) && arr.length > 0) {
        const escapedElements = arr.map(u => `'${escapeSql(u.replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, activeDomain))}'`);
        formattedThumbUrls = `ARRAY[${escapedElements.join(', ')}]::text[]`;
      }
    } catch (e) {}
  }

  const sqlImgUrl = imageUrl ? `'${escapeSql(imageUrl)}'` : 'NULL';
  const sqlThumbUrl = thumbnailUrl ? `'${escapeSql(thumbnailUrl)}'` : 'NULL';

  const whereClause = id ? `id = '${escapeSql(id)}'` : `sku = '${escapeSql(sku)}'`;
  const statement = `UPDATE public.items SET image_url = ${sqlImgUrl}, image_urls = ${formattedImageUrls}, thumbnail_url = ${sqlThumbUrl}, thumbnail_urls = ${formattedThumbUrls}, updated_at = NOW() WHERE ${whereClause};`;
  
  sqlStatements.push(statement);
  count++;
}

sqlStatements.push('\nCOMMIT;');
fs.writeFileSync(outputSqlPath, sqlStatements.join('\n'), 'utf8');
console.log(`Generated active domain SQL script with ${count} statements.`);
