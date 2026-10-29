import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Animated
} from 'react-native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { supabase } from '../../supabase';
import { useAuth } from '../contexts/AuthContext';
import { Product } from '../data/products';
import * as ImagePicker from 'expo-image-picker';
import { ensureVendorAccount } from '../utils/vendorService';

import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';

interface AddProductScreenProps {
  scrollY?: Animated.Value;
}

const CATEGORIES = ["Gold", "Diamonds", "Polki", "Kundan"];

const SUB_OPTIONS_MAP: Record<string, string[]> = {
  "Necklace": ["Necklace Short/Medium", "Necklace Set"],
  "Earrings": ["Studs", "Jumkies", "Fancy"],
  "Lockets": ["Unisex"],
  "Rings": ["Men", "Women"],
  "Bracelet": ["Plain", "Stones"],
  "Bangles": ["Plain", "Stones"],
  "Other": ["Coins", "Bhajubandh / Vanki", "Watch", "Tikka / Matti"],
};

const AddProductScreen: React.FC<AddProductScreenProps> = ({ scrollY }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AddProduct'>>();
  const { vendorId, product } = route.params || {};
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [internalVendorId, setInternalVendorId] = useState<string>(vendorId || product?.vendorId || (product as any)?.vendor_id || "");
  const [verifyingProfile, setVerifyingProfile] = useState(!vendorId && !product?.vendorId && !(product as any)?.vendor_id);
  const [isLinkingAccount, setIsLinkingAccount] = useState(false);
  
  useEffect(() => {
    const initProfile = async () => {
      // 1. Try to get vendorId from URL query params (Web fallback)
      let queryVendorId = "";
      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        queryVendorId = params.get('vendorId') || "";
      }

      // 2. Resolve final vendorId
      let finalVendorId = vendorId || queryVendorId || product?.vendorId || (product as any)?.vendor_id;

      if (finalVendorId) {
        setInternalVendorId(finalVendorId);
        setVerifyingProfile(false);
        return;
      }

      if (user) {
        console.log("Missing vendorId, fetching or creating vendor account for user:", user.id);
        try {
          const { data } = await supabase
            .from('vendor_settings')
            .select('vendor_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data?.vendor_id) {
            console.log("VendorId found:", data.vendor_id);
            finalVendorId = data.vendor_id;
          } else {
            console.log("Attempting auto-provisioning of vendor account...");
            const linkedId = await ensureVendorAccount(user);
            if (linkedId) {
              finalVendorId = linkedId;
            }
          }
        } catch (e) {
          console.warn("Attempting auto-provisioning fallback after error:", e);
          const linkedId = await ensureVendorAccount(user);
          if (linkedId) {
            finalVendorId = linkedId;
          }
        }
      }

      // 3. Fallback to any host vendor in DB if available
      if (!finalVendorId) {
        try {
          const { data: hostVendors } = await supabase.from('vendors').select('id').limit(1);
          if (hostVendors && hostVendors.length > 0) {
            finalVendorId = hostVendors[0].id;
          }
        } catch (err) {
          console.warn("Host vendor fallback query failed:", err);
        }
      }

      if (finalVendorId) {
        setInternalVendorId(finalVendorId);
      }
      setVerifyingProfile(false);
    };

    initProfile();
  }, [vendorId, product, user]);
  
  // Form State
  const [name, setName] = useState(product?.name || "New Masterpiece");
  const [category, setCategory] = useState(product?.category || "Gold");
  const [imageUrl, setImageUrl] = useState(product?.image || "https://tnvdmftovccgfrllaffq.supabase.co/storage/v1/object/public/products/logo.jpg");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(product?.galleryUrls || []);
  const [productCode, setProductCode] = useState(product?.productCode || `MJ-${Date.now().toString().slice(-6)}`);
  const [grossWeight, setGrossWeight] = useState(product?.grossWeight?.toString() || "1.000");
  const [goldWeight, setGoldWeight] = useState(product?.goldWeight?.toString() || "1.000");
  const [purity, setPurity] = useState(product?.purity || "22 KT");
  const [metalColor, setMetalColor] = useState(product?.metalColor || "Yellow Gold");
  
  // New Metadata
  const [type, setType] = useState(product?.type || "Boutique");
  const [collection, setCollection] = useState(product?.collection || "Legacy");
  const [gender, setGender] = useState(product?.gender || "Women");
  const [occasion, setOccasion] = useState(product?.occasion || "Bridal");
  const [designTheme, setDesignTheme] = useState(product?.designTheme || "Traditional");
  const [gemstoneType, setGemstoneType] = useState(product?.gemstoneType || "None");
  const [gemstoneWeight, setGemstoneWeight] = useState(product?.gemstoneWeight?.toString() || "0.00");
  const [stockQuantity, setStockQuantity] = useState(product?.stockQuantity?.toString() || "1");
  const [sourcingCost, setSourcingCost] = useState(product?.sourcingCost?.toString() || "0");
  const [matchingProductId, setMatchingProductId] = useState<string>((product as any)?.matchingProductId || "");
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [showMatchingPicker, setShowMatchingPicker] = useState(false);

  const [selectedMainType, setSelectedMainType] = useState<string>(() => {
    const initialType = product?.type || "Necklace";
    const t = initialType.toLowerCase();
    if (t.includes("necklace")) return "Necklace";
    if (t.includes("earring") || t === "studs" || t === "jumkies" || t === "fancy") return "Earrings";
    if (t.includes("locket") || t.includes("pendant") || t === "unisex") return "Lockets";
    if (t.includes("ring")) return "Rings";
    if (t.includes("bracelet")) return "Bracelet";
    if (t.includes("bangle")) return "Bangles";
    
    const found = ["Necklace", "Earrings", "Lockets", "Rings", "Bracelet", "Bangles", "Haram", "Chain", "Vaddanam", "Tikka", "Watch", "Coins", "Bhajubandh", "Accessories"]
      .find(mt => mt.toLowerCase() === t);
    return found || "Accessories";
  });

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, product_code')
          .order('name', { ascending: true });
        if (!error && data) {
          const filtered = data.filter(p => !product || p.id !== product.id);
          setAllProducts(filtered);
        }
      } catch (err) {
        console.error("Error fetching products list:", err);
      }
    };
    fetchAllProducts();
  }, [product?.id]);
  
  // Price Breakup
  const [metalPrice, setMetalPrice] = useState(product?.priceBreakup?.metal?.toString() || "100");
  const [vaMaking, setVaMaking] = useState(product?.priceBreakup?.vaMaking?.toString() || "0");
  const [stoneBeads, setStoneBeads] = useState(product?.priceBreakup?.stoneBeads?.toString() || "0");
  const [tax, setTax] = useState(product?.priceBreakup?.tax?.toString() || "0");

  const handlePickImage = async (isGallery = false) => {
    // Request permission first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "Sorry, we need camera roll permissions to make this work!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: !isGallery, // Allow editing for primary image
      allowsMultipleSelection: isGallery, // Allow multiple for gallery
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (isGallery) {
        for (const asset of result.assets) {
           await uploadImage(asset.uri, true);
        }
      } else {
        await uploadImage(result.assets[0].uri, false);
      }
    }
  };

  const uploadImage = async (uri: string, isGallery: boolean) => {
    setUploading(true);
    try {
      const folderName = internalVendorId || user?.id || 'admin';
      const imgIndex = isGallery ? galleryUrls.length + 2 : 1;
      const cleanCode = (productCode || name || 'item').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${folderName}/${cleanCode}_${imgIndex}_${Date.now()}.jpg`;
      
      const response = await fetch(uri);
      const body = await response.blob();

      const { data, error } = await supabase.storage
        .from('products')
        .upload(fileName, body, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        if (error.message.includes("Bucket not found")) {
          throw new Error("Supabase Storage bucket 'products' not found. Please create it in your Supabase dashboard.");
        }
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      console.log("Generated Public URL:", publicUrl);

      if (isGallery) {
        setGalleryUrls(prev => [...prev, publicUrl]);
      } else {
        setImageUrl(publicUrl);
      }
      // Success feedback is silent for better flow
    } catch (error: any) {
      console.error("Error uploading image:", error);
      Alert.alert("Upload Failed", error.message || "Failed to upload image. Ensure the 'products' bucket exists and is public.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddProduct = async () => {
    let effectiveVendorId = internalVendorId;
    if (!effectiveVendorId) {
      if (user) {
        effectiveVendorId = (await ensureVendorAccount(user)) || "";
      }
      if (!effectiveVendorId) {
        try {
          const { data: hostVendors } = await supabase.from('vendors').select('id').limit(1);
          if (hostVendors && hostVendors.length > 0) {
            effectiveVendorId = hostVendors[0].id;
          }
        } catch (err) {
          console.warn("Could not fetch fallback vendor ID:", err);
        }
      }
      if (effectiveVendorId) {
        setInternalVendorId(effectiveVendorId);
      }
    }

    console.log("Attempting product save with vendorId:", effectiveVendorId);

    if (!name || !imageUrl || !productCode || !grossWeight || !metalPrice) {
      Alert.alert("Error", "Please fill in all required fields (Name, Image, Code, Gross Weight, Metal Price)");
      return;
    }

    setLoading(true);
    try {
      // Basic weight validation
      const gWeight = parseFloat(grossWeight);
      const goldW = parseFloat(goldWeight || "0");
      
      if (isNaN(gWeight) || gWeight <= 0) {
        throw new Error("Please enter a valid gross weight.");
      }

      const mPrice = parseFloat(metalPrice) || 0;
      const vMaking = parseFloat(vaMaking) || 0;
      const sBeads = parseFloat(stoneBeads) || 0;
      const tTax = parseFloat(tax) || 0;
      const basePrice = mPrice + vMaking + sBeads + tTax;

      if (basePrice <= 0) {
        throw new Error("Product must have a total price greater than 0.");
      }

      const productPayload: any = {
        name,
        category_name: category,
        image_url: imageUrl,
        product_code: productCode,
        gross_weight: gWeight,
        gold_weight: goldW,
        purity,
        metal_color: metalColor,
        base_price_usd: basePrice,
        metal_price_usd: mPrice,
        va_making_usd: vMaking,
        stone_beads_usd: sBeads,
        tax_usd: tTax,
        ...(effectiveVendorId ? { vendor_id: effectiveVendorId } : {}),
        stock_quantity: parseInt(stockQuantity || "0"),
        sourcing_cost: parseFloat(sourcingCost || "0"),
        type,
        collection,
        gender,
        occasion,
        design_theme: designTheme,
        gemstone_type: gemstoneType,
        gemstone_weight: parseFloat(gemstoneWeight || "0"),
        gallery_urls: galleryUrls,
        matching_product_id: matchingProductId || null
      };

      if (!product) {
        productPayload.rating = 0;
        productPayload.popularity = 0;
      }

      console.log(product ? "Updating Product:" : "Inserting Product:", JSON.stringify(productPayload, null, 2));

      let error;
      if (product) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', product.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('products')
          .insert([productPayload]);
        error = insertError;
      }

      if (error) {
        // Handle specific Supabase error codes
        if (error.code === '42501') {
          throw new Error("Permission Denied: Your account role does not allow modifying products for this vendor. Please ensure your Admin RLS policies are applied.");
        } else if (error.code === '23505') {
          throw new Error(`The product code "${productCode}" is already in use. Please use a unique code.`);
        } else if (error.code === '23503') {
          throw new Error(`The category "${category}" is not valid. Please select a valid category.`);
        }
        throw error;
      }

      Alert.alert("Success", product ? "Masterpiece updated successfully!" : "Your masterpiece has been listed successfully!");
      navigation.goBack();
    } catch (error: any) {
      console.error("Final Error in handleAddProduct:", error);
      
      let errorTitle = "Action Failed";
      let errorMsg = error.message || "An unexpected error occurred.";

      if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
        errorTitle = "Network Error";
        errorMsg = "Please check your internet connection and try again.";
      }

      Alert.alert(errorTitle, errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrapper}>
            <View style={styles.formSection}>
              <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← BACK</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{product ? 'EDIT MASTERPIECE' : 'LIST NEW MASTERPIECE'}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>CATEGORY</Text>
                <View style={styles.pickerContainer}>
                   {CATEGORIES.map(cat => (
                     <TouchableOpacity 
                        key={cat} 
                        style={[styles.pickerItem, category === cat && styles.activePickerItem]}
                        onPress={() => setCategory(cat)}
                      >
                       <Text style={[styles.pickerText, category === cat && styles.activePickerText]}>{cat}</Text>
                     </TouchableOpacity>
                   ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT NAME *</Text>
                <TextInput 
                  style={styles.input} 
                  value={name} 
                  onChangeText={setName} 
                  placeholder="e.g. Traditional Gold Necklace"
                  placeholderTextColor="#666"
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT CODE *</Text>
                <TextInput 
                  style={styles.input} 
                  value={productCode} 
                  onChangeText={setProductCode} 
                  placeholder="e.g. MJK-101"
                  placeholderTextColor="#666"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT IMAGE *</Text>
                <View style={styles.imageUploadContainer}>
                  {imageUrl ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: imageUrl }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImageUrl("")}>
                        <Text style={styles.removeImageText}>REMOVE</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      style={styles.uploadBtn} 
                      onPress={() => handlePickImage(false)}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator color="#D4AF37" />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.uploadBtnText}>+ SELECT IMAGE</Text>
                          <Text style={styles.uploadBtnSubtext}>JPEG or PNG up to 5MB</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={{ marginTop: 15 }}>
                    <Text style={styles.label}>OR PROVIDE IMAGE URL</Text>
                    <TextInput 
                      style={styles.input} 
                      value={imageUrl} 
                      onChangeText={setImageUrl} 
                      placeholder="https://example.com/image.jpg"
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>
              </View>

              <View style={[styles.inputGroup, { marginTop: 10 }]}>
                <Text style={styles.label}>GALLERY IMAGES (OPTIONAL)</Text>
                <View style={styles.imageUploadContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryPreviewScroll}>
                    {galleryUrls.map((url, idx) => (
                      <View key={idx} style={styles.galleryPreviewItem}>
                        <Image source={{ uri: url }} style={styles.galleryPreviewImage} />
                        <TouchableOpacity 
                          style={styles.galleryRemoveBtn} 
                          onPress={() => setGalleryUrls(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <Text style={styles.galleryRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    
                    <TouchableOpacity 
                      style={styles.addGalleryBtn} 
                      onPress={() => handlePickImage(true)}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator color="#D4AF37" />
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.addGalleryText}>+ ADD</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
                <Text style={styles.helpText}>Provide multiple perspectives for a luxury experience.</Text>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>GROSS WEIGHT (g) *</Text>
                  <TextInput 
                    style={styles.input} 
                    value={grossWeight} 
                    onChangeText={setGrossWeight} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>GOLD WEIGHT (g)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={goldWeight} 
                    onChangeText={setGoldWeight} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>PURITY</Text>
                  <TextInput 
                    style={styles.input} 
                    value={purity} 
                    onChangeText={setPurity} 
                    placeholder="e.g. 22K"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>METAL COLOR</Text>
                  <TextInput 
                    style={styles.input} 
                    value={metalColor} 
                    onChangeText={setMetalColor} 
                    placeholder="e.g. Yellow"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>CLASSIFICATION</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>PRODUCT TYPE</Text>
                <View style={styles.pickerContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {["Necklace", "Earrings", "Lockets", "Rings", "Bracelet", "Bangles", "Other"].map(mt => (
                      <TouchableOpacity 
                         key={mt} 
                         style={[styles.pickerItem, selectedMainType === mt && styles.activePickerItem]}
                         onPress={() => {
                           setSelectedMainType(mt);
                           if (mt === "Rings") {
                             setType("Rings");
                             setGender("Women");
                           } else if (mt === "Lockets") {
                             setType("Lockets");
                             setGender("Unisex");
                           } else if (mt === "Earrings") {
                             setType("Studs");
                           } else if (mt === "Necklace") {
                             setType("Necklace Short/Medium");
                           } else if (mt === "Bracelet" || mt === "Bangles") {
                             setType("Plain");
                           } else if (mt === "Other") {
                             setType("Coins");
                           } else {
                             setType(mt);
                           }
                         }}
                      >
                        <Text style={[styles.pickerText, selectedMainType === mt && styles.activePickerText]}>{mt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Sub-options for Product Type */}
              {SUB_OPTIONS_MAP[selectedMainType] && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{selectedMainType.toUpperCase()} SUB-CATEGORY</Text>
                  <View style={styles.pickerContainer}>
                    {SUB_OPTIONS_MAP[selectedMainType].map(opt => {
                      let isSel = false;
                      if (selectedMainType === "Rings") {
                        isSel = gender === opt;
                      } else if (selectedMainType === "Lockets") {
                        isSel = gender === opt;
                      } else {
                        isSel = type.toLowerCase() === opt.toLowerCase();
                      }
                      
                      return (
                        <TouchableOpacity 
                          key={opt} 
                          style={[styles.pickerItem, isSel && styles.activePickerItem]}
                          onPress={() => {
                            if (selectedMainType === "Rings") {
                              setGender(opt);
                              setType("Rings");
                            } else if (selectedMainType === "Lockets") {
                              setGender(opt);
                              setType("Lockets");
                            } else {
                              setType(opt);
                            }
                          }}
                        >
                          <Text style={[styles.pickerText, isSel && styles.activePickerText]}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>COLLECTION</Text>
                  <TextInput 
                    style={styles.input} 
                    value={collection} 
                    onChangeText={setCollection} 
                    placeholder="e.g. Heritage, Royal"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>OCCASION</Text>
                  <TextInput 
                    style={styles.input} 
                    value={occasion} 
                    onChangeText={setOccasion} 
                    placeholder="e.g. Anniversary, Wedding"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>GENDER</Text>
                  <View style={styles.pickerContainer}>
                     {["Women", "Men", "Unisex"].map(g => (
                       <TouchableOpacity 
                          key={g} 
                          style={[styles.pickerItem, gender === g && styles.activePickerItem]}
                          onPress={() => setGender(g)}
                        >
                         <Text style={[styles.pickerText, gender === g && styles.activePickerText]}>{g}</Text>
                       </TouchableOpacity>
                     ))}
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>DESIGN THEME</Text>
                  <TextInput 
                    style={styles.input} 
                    value={designTheme} 
                    onChangeText={setDesignTheme} 
                    placeholder="e.g. Elevated Tradition"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>GEMSTONE DETAILS</Text>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>GEMSTONE TYPE</Text>
                  <TextInput 
                    style={styles.input} 
                    value={gemstoneType} 
                    onChangeText={setGemstoneType} 
                    placeholder="e.g. Synthetic, Diamond, Ruby"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>GEMSTONE WEIGHT (ct/g)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={gemstoneWeight} 
                    onChangeText={setGemstoneWeight} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>STOCK QUANTITY</Text>
                  <TextInput 
                    style={styles.input} 
                    value={stockQuantity} 
                    onChangeText={setStockQuantity} 
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>SOURCING COST (USD)</Text>
                  <TextInput 
                    style={styles.input} 
                    value={sourcingCost} 
                    onChangeText={setSourcingCost} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>PRICE BREAKUP (USD)</Text>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>METAL PRICE *</Text>
                  <TextInput 
                    style={styles.input} 
                    value={metalPrice} 
                    onChangeText={setMetalPrice} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>VA / MAKING</Text>
                  <TextInput 
                    style={styles.input} 
                    value={vaMaking} 
                    onChangeText={setVaMaking} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>STONE & BEADS</Text>
                  <TextInput 
                    style={styles.input} 
                    value={stoneBeads} 
                    onChangeText={setStoneBeads} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>TAX / GST</Text>
                  <TextInput 
                    style={styles.input} 
                    value={tax} 
                    onChangeText={setTax} 
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>EXPLICIT MATCHING PRODUCT (RECOMMENDATION)</Text>
                <TouchableOpacity 
                  style={styles.pickerSelector} 
                  onPress={() => setShowMatchingPicker(!showMatchingPicker)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerSelectorText}>
                    {matchingProductId 
                      ? allProducts.find(p => p.id === matchingProductId)?.name || "Select matching product..."
                      : "None (Use automatic pairing)"}
                  </Text>
                  <Text style={styles.pickerArrow}>{showMatchingPicker ? "▲" : "▼"}</Text>
                </TouchableOpacity>
                
                {showMatchingPicker && (
                  <View style={styles.matchingPickerList}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                      <TouchableOpacity 
                        style={[styles.matchingPickerItem, !matchingProductId && styles.matchingPickerItemActive]}
                        onPress={() => {
                          setMatchingProductId("");
                          setShowMatchingPicker(false);
                        }}
                      >
                        <Text style={[styles.matchingPickerItemText, !matchingProductId && styles.matchingPickerItemTextActive]}>
                          None (Use automatic pairing)
                        </Text>
                      </TouchableOpacity>
                      {allProducts.map(p => (
                        <TouchableOpacity 
                          key={p.id}
                          style={[styles.matchingPickerItem, matchingProductId === p.id && styles.matchingPickerItemActive]}
                          onPress={() => {
                            setMatchingProductId(p.id);
                            setShowMatchingPicker(false);
                          }}
                        >
                          <Text style={[styles.matchingPickerItemText, matchingProductId === p.id && styles.matchingPickerItemTextActive]}>
                            {p.name} ({p.product_code})
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, (loading || uploading) && styles.disabledBtn]} 
                onPress={handleAddProduct}
                disabled={loading || uploading}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>{product ? 'CONFIRM & UPDATE PRODUCT' : 'CONFIRM & LIST PRODUCT'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <Footer />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#291c0e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  formSection: {
    padding: 20,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    marginBottom: 40,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  loadingText: {
    color: '#D4AF37',
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorTitle: {
    fontFamily: 'TrajanPro',
    fontSize: 24,
    color: '#ff4444',
    marginBottom: 15,
  },
  errorSubtitle: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
    maxWidth: 500,
  },
  backBtnLarge: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 6,
  },
  backBtnTextLarge: {
    color: '#D4AF37',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    gap: 20,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 4,
  },
  backBtnText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    fontFamily: 'TrajanPro',
    fontSize: 22,
    color: '#D4AF37',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: 'TrajanPro',
    fontSize: 16,
    color: '#D4AF37',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
    paddingBottom: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#3d2b1a',
    borderWidth: 1,
    borderColor: '#4a3520',
    borderRadius: 6,
    padding: 12,
    color: '#fff',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4a3520',
    borderRadius: 4,
    backgroundColor: '#3d2b1a',
  },
  activePickerItem: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  pickerText: {
    color: '#888',
    fontSize: 11,
  },
  activePickerText: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 18,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  imageUploadContainer: {
    backgroundColor: '#3d2b1a',
    borderWidth: 1,
    borderColor: '#4a3520',
    borderRadius: 8,
    padding: 15,
  },
  uploadBtn: {
    height: 120,
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  uploadBtnText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  uploadBtnSubtext: {
    color: '#666',
    fontSize: 10,
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  removeImageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 4,
  },
  removeImageText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  helpText: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  galleryPreviewScroll: {
    gap: 15,
    alignItems: 'center',
    paddingVertical: 5,
  },
  galleryPreviewItem: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  galleryPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4a3520',
    resizeMode: 'cover',
  },
  galleryRemoveBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3d2b1a',
    zIndex: 10,
  },
  galleryRemoveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  addGalleryBtn: {
    width: 100,
    height: 100,
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    marginLeft: 5,
  },
  addGalleryText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pickerSelector: {
    backgroundColor: '#3d2b1a',
    borderWidth: 1,
    borderColor: '#4a3520',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerSelectorText: {
    color: '#fff',
    fontSize: 14,
  },
  pickerArrow: {
    color: '#D4AF37',
    fontSize: 10,
  },
  matchingPickerList: {
    backgroundColor: '#312112',
    borderWidth: 1,
    borderColor: '#4a3520',
    borderRadius: 6,
    marginTop: 5,
  },
  matchingPickerItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#4a3520',
  },
  matchingPickerItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  matchingPickerItemText: {
    color: '#aaa',
    fontSize: 13,
  },
  matchingPickerItemTextActive: {
    color: '#D4AF37',
    fontWeight: 'bold',
  },
});

export default AddProductScreen;
