const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://tnvdmftovccgfrllaffq.supabase.co';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllStorageFiles() {
  console.log('Connecting to Supabase Storage at:', supabaseUrl);

  const buckets = ['item-images', 'products'];

  for (const bucket of buckets) {
    console.log(`\n=== Listing files in bucket: '${bucket}' ===`);
    
    // List root folder
    const { data: rootFiles, error: rootErr } = await supabase.storage.from(bucket).list('', { limit: 100 });
    if (rootErr) {
      console.error(`Error listing root of '${bucket}':`, rootErr.message);
      continue;
    }

    console.log(`Root contents of '${bucket}' (${rootFiles ? rootFiles.length : 0} items):`);
    for (const file of rootFiles || []) {
      console.log(` - ${file.name} (${file.id ? 'File' : 'Folder'})`);
      
      // If folder (e.g. 'items' or vendor ID), list files inside folder
      if (!file.id || file.metadata === null) {
        const { data: subFiles, error: subErr } = await supabase.storage.from(bucket).list(file.name, { limit: 100 });
        if (subFiles && subFiles.length > 0) {
          console.log(`   Inside folder '${file.name}/': ${subFiles.length} files`);
          subFiles.slice(0, 10).forEach(f => console.log(`     -> ${file.name}/${f.name}`));
        }
      }
    }
  }
}

listAllStorageFiles().catch(err => console.error(err));
