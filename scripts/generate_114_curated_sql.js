const fs = require('fs');
const papa = require('C:/Users/srika/development/my-new-app/node_modules/papaparse');

const csvPath = 'C:/Users/srika/Downloads/items_rows (31).csv';
const outputSqlPath = 'C:/Users/srika/development/my-new-app/load_114_curated_products.sql';

const csvContent = fs.readFileSync(csvPath, 'utf8');

const parsed = papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true
});

const matchingInfo = JSON.parse(fs.readFileSync('C:/Users/srika/.gemini/antigravity-cli/brain/6e1c3b20-86af-43d9-ac1b-f04f9596b669/scratch/matching_sku_products.json', 'utf8'));
const matchMap = new Map();
matchingInfo.forEach(m => matchMap.set(m.id, m));

const matchedRows = parsed.data.filter(r => matchMap.has(r.id));

const escapeSql = (str) => {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/'/g, "''");
};

const inferCategoryAndType = (row) => {
  const name = (row.name || "Moksha Masterpiece").trim();
  const sku = (row.sku || row.label_no || "").trim();
  const labelNo = (row.label_no || "").trim();
  const daiWt = parseFloat(row.dai_wt || 0);
  const daiPcs = parseInt(row.dai_pcs || 0);
  const stonesDetailStr = typeof row.stones_in_detail === 'string'
    ? row.stones_in_detail
    : (Array.isArray(row.stones_in_detail) ? JSON.stringify(row.stones_in_detail) : '');
  const upperStones = stonesDetailStr.toUpperCase();
  const upperName = name.toUpperCase();
  const upperSku = sku.toUpperCase();
  const upperLabel = labelNo.toUpperCase();

  let category = row.category_name || row.category;
  if (!category || category === "Gold") {
    if (upperName.includes('POLKI') || upperSku.includes('POLKI')) {
      category = 'Polki';
    } else if (upperName.includes('KUNDAN') || upperSku.includes('KUNDAN') || upperSku.startsWith('GK')) {
      category = 'Kundan';
    } else if (
      upperName.startsWith('D ') || 
      upperSku.startsWith('D') || 
      upperLabel.startsWith('D') || 
      daiWt > 0 || 
      daiPcs > 0 || 
      upperStones.includes('DIAMOND')
    ) {
      category = 'Diamonds';
    } else {
      category = 'Gold';
    }
  }

  let type = row.type;
  if (!type) {
    const combined = `${name} ${sku} ${labelNo}`.toUpperCase();
    if (/(TOPS|DTPS|JUMKA|JUMKI|DJK|GJM|BALI|GBL|HANGING|GHG|EARRING|STUD|BUTTALU|DBL|DHJ|GKHS)/i.test(combined)) {
      type = 'Ear Rings';
    } else if (/(VADDANAM|DVD|BAJUBAND|BJB)/i.test(combined)) {
      type = 'Bajubands';
    } else if (/(RING|DRG|GRG)/i.test(combined)) {
      type = 'Rings';
    } else if (/(BANGLE|DBG|GBP|KADA|GKD|BRACELET|BRACELETE|DBR|GBR)/i.test(combined)) {
      type = 'Bangles';
    } else if (/(BLACK BEED|BLACKBEED|BLACK BEEDS|BLACKBEEDS|CHAIN|GCH|BBC|DBB)/i.test(combined)) {
      type = 'Chains';
    } else if (/(CHOKER|CHOUKER|CHOWKER|DCK|GCK)/i.test(combined)) {
      type = 'Chokers';
    } else if (/(HARAM|HAARAM|DHR|GHR|GKHA)/i.test(combined)) {
      type = 'Harams';
    } else if (/(PENDANT|DPNT|GPNT|GPD)/i.test(combined)) {
      type = 'Pendants';
    } else {
      type = 'Necklaces';
    }
  }

  return { category, type };
};

const sqlStatements = [
  '--',
  '-- Moksha Jewels - Curated Catalog Update (114 Verified SKU Items - Strictly 1 SKU Image)',
  '-- Generated on: ' + new Date().toISOString(),
  '--',
  'BEGIN;\n',
  '-- 1. Remove all items that are not in the 114 curated list',
  `DELETE FROM public.items WHERE id NOT IN (\n  ${matchedRows.map(r => `'${escapeSql(r.id)}'`).join(',\n  ')}\n);\n`,
  '-- 2. Upsert each of the 114 curated items with strictly 1 verified SKU image'
];

matchedRows.forEach(row => {
  const match = matchMap.get(row.id);
  const id = escapeSql(row.id);
  const name = escapeSql(row.name || 'Moksha Masterpiece');
  const sku = escapeSql((row.sku || row.label_no || '').trim());
  const labelNo = escapeSql((row.label_no || '').trim());
  const location = escapeSql(row.location || '');
  const supplierName = escapeSql(row.supplier_name || '');
  const docNo = escapeSql(row.doc_no || '');
  const huid = escapeSql(row.huid || '');

  let purity = (row.purity || '22K').toString().trim();
  if (purity === '22') purity = '22K';
  if (purity === '18') purity = '18K';
  purity = escapeSql(purity);

  const grossWt = parseFloat(row.gross_wt) || 0;
  const netWt = parseFloat(row.net_wt) || 0;
  const daiWt = parseFloat(row.dai_wt) || 0;
  const daiPcs = parseInt(row.dai_pcs) || 0;
  const clrStoneWt = parseFloat(row.clr_stone_wt) || 0;
  const clrStonePcs = parseInt(row.clr_stone_pcs) || 0;
  const wastage = parseFloat(row.wastage) || 0;
  const labourRate = parseFloat(row.labour_rate) || 0;
  const labourAmt = parseFloat(row.labour_amt) || 0;
  const costPrice = parseFloat(row.cost_price || row.prc_amount) || 0;
  const prcAmount = parseFloat(row.prc_amount || row.cost_price) || 0;

  const { category, type } = inferCategoryAndType(row);

  // Strictly 1 verified image matching the item SKU
  const imgUrl = escapeSql(match.image_url);
  const formattedImageUrls = `ARRAY['${imgUrl}']::text[]`;
  const formattedThumbUrls = `ARRAY['${imgUrl}']::text[]`;
  const thumbUrl = `'${imgUrl}'`;

  // Stones in detail
  let stonesInDetailStr = 'NULL';
  if (row.stones_in_detail && row.stones_in_detail !== '[]') {
    stonesInDetailStr = `'${escapeSql(row.stones_in_detail)}'`;
  }

  const upsertSql = `INSERT INTO public.items (
  id, name, sku, label_no, category_name, type, purity,
  gross_wt, net_wt, dai_wt, dai_pcs, clr_stone_wt, clr_stone_pcs,
  wastage, labour_rate, labour_amt, cost_price, prc_amount,
  image_url, image_urls, thumbnail_url, thumbnail_urls,
  stones_in_detail, location, supplier_name, doc_no, huid,
  quantity, pcs, unit, updated_at
) VALUES (
  '${id}', '${name}', '${sku}', '${labelNo}', '${escapeSql(category)}', '${escapeSql(type)}', '${purity}',
  ${grossWt}, ${netWt}, ${daiWt}, ${daiPcs}, ${clrStoneWt}, ${clrStonePcs},
  ${wastage}, ${labourRate}, ${labourAmt}, ${costPrice}, ${prcAmount},
  '${imgUrl}', ${formattedImageUrls}, ${thumbUrl}, ${formattedThumbUrls},
  ${stonesInDetailStr}, '${location}', '${supplierName}', '${docNo}', '${huid}',
  1, 1, 'pcs', NOW()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sku = EXCLUDED.sku,
  label_no = EXCLUDED.label_no,
  category_name = EXCLUDED.category_name,
  type = EXCLUDED.type,
  purity = EXCLUDED.purity,
  gross_wt = EXCLUDED.gross_wt,
  net_wt = EXCLUDED.net_wt,
  dai_wt = EXCLUDED.dai_wt,
  dai_pcs = EXCLUDED.dai_pcs,
  clr_stone_wt = EXCLUDED.clr_stone_wt,
  clr_stone_pcs = EXCLUDED.clr_stone_pcs,
  wastage = EXCLUDED.wastage,
  labour_rate = EXCLUDED.labour_rate,
  labour_amt = EXCLUDED.labour_amt,
  cost_price = EXCLUDED.cost_price,
  prc_amount = EXCLUDED.prc_amount,
  image_url = EXCLUDED.image_url,
  image_urls = EXCLUDED.image_urls,
  thumbnail_url = EXCLUDED.thumbnail_url,
  thumbnail_urls = EXCLUDED.thumbnail_urls,
  stones_in_detail = EXCLUDED.stones_in_detail,
  updated_at = NOW();`;

  sqlStatements.push(upsertSql);
});

sqlStatements.push('\nCOMMIT;');

fs.writeFileSync(outputSqlPath, sqlStatements.join('\n\n'), 'utf8');
console.log(`Generated ${outputSqlPath} with strictly 1 SKU image per item.`);
