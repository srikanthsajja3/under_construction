import { supabase } from '../../supabase';

/**
 * Ensures an authenticated user has a linked vendor account in Supabase.
 * If vendor_settings or vendor record is missing/unlinked, it creates and links it.
 */
export async function ensureVendorAccount(user: { id: string; email?: string; user_metadata?: any }): Promise<string | null> {
  if (!user || !user.id) return null;

  try {
    // 1. Check existing vendor_settings
    const { data: settings } = await supabase
      .from('vendor_settings')
      .select('*, vendors(*)')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settings && settings.vendor_id) {
      return settings.vendor_id;
    }

    const businessName = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : '') || `Artisan ${user.id.slice(0, 6)}`;
    
    // 2. Find or create vendor record
    let vendorId: string | null = settings?.vendor_id || null;

    if (!vendorId) {
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', businessName)
        .maybeSingle();

      if (existingVendor?.id) {
        vendorId = existingVendor.id;
      } else {
        const { data: newVendor, error: createErr } = await supabase
          .from('vendors')
          .insert({
            name: businessName,
            contact_person: user.user_metadata?.full_name || businessName,
            email: user.email || '',
            rating: 5.0
          })
          .select('id')
          .single();

        if (createErr || !newVendor?.id) {
          console.warn('Vendor creation fallback triggered:', createErr?.message);
          const uniqueName = `${businessName} (${Date.now().toString().slice(-4)})`;
          const { data: fallbackVendor } = await supabase
            .from('vendors')
            .insert({
              name: uniqueName,
              email: user.email || ''
            })
            .select('id')
            .single();

          vendorId = fallbackVendor?.id || null;
        } else {
          vendorId = newVendor.id;
        }
      }
    }

    if (vendorId) {
      // 3. Link vendor_id in vendor_settings
      await supabase
        .from('vendor_settings')
        .upsert({
          user_id: user.id,
          vendor_id: vendorId,
          business_name: businessName,
          is_verified: true
        }, { onConflict: 'user_id' });

      // 4. Update profile role if needed
      await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', user.id);

      return vendorId;
    }
  } catch (err) {
    console.error('ensureVendorAccount error:', err);
  }

  return null;
}
