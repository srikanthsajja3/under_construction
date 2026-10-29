import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
  Animated
} from 'react-native';
import Header from '../components/Header';
import Footer from '../components/Footer';
import OptimizedImage from '../components/OptimizedImage';
import { supabase } from '../../supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../contexts/CountryContext';
import { formatPrice } from '../utils/currency';
import { Product, mapProduct } from '../data/products';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse';

import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useUI } from '../contexts/UIContext';
import { useRef } from 'react';

interface VendorDashboardScreenProps {
  scrollY?: Animated.Value;
}

const VendorDashboardScreen: React.FC<VendorDashboardScreenProps> = ({ scrollY: scrollYProp }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { setLoginVisible } = useUI();
  const { isVendor, user } = useAuth();
  
  const localScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = scrollYProp || localScrollY;
  
  const { countryCode } = useCountry();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmallMobile = width < 480;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'm2m'>('overview');
  
  const [vendorSettings, setVendorSettings] = useState<any>(null);
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [mySales, setMySales] = useState<any[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [productIdToDelete, setProductIdToDelete] = useState<string | null>(null);

  // Derived Analytics
  const totalRevenue = mySales.reduce((sum, sale) => sum + (sale.price_at_purchase * sale.quantity), 0);
  const totalOrders = mySales.length;
  const activeProductsCount = myProducts.length;
  const lowStockCount = myProducts.filter((p: any) => p.stock_quantity < 5).length;

  useEffect(() => {
    if (isVendor) {
      fetchVendorData();
    }
  }, [isVendor]);

  const fetchVendorData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let { data: settings, error: sError } = await supabase
        .from('vendor_settings')
        .select('*, vendors(*)')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!settings || !settings.vendor_id) {
        console.log('Vendor settings or vendor_id missing, auto-linking vendor account for user:', user.id);
        const { ensureVendorAccount } = await import('../utils/vendorService');
        const vendorId = await ensureVendorAccount(user);
        if (vendorId) {
          const { data: updatedSettings } = await supabase
            .from('vendor_settings')
            .select('*, vendors(*)')
            .eq('user_id', user.id)
            .maybeSingle();
          settings = updatedSettings;
        }
      }

      setVendorSettings(settings);

      if (settings?.vendor_id) {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .eq('vendor_id', settings.vendor_id);
        
        setMyProducts(products?.map(mapProduct) || []);

        const productIds = products?.map(p => p.id) || [];
        
        if (productIds.length > 0) {
          const { data: sales } = await supabase
            .from('order_items')
            .select('*, orders(*)')
            .in('product_id', productIds)
            .order('created_at', { ascending: false });
          
          setMySales(sales || []);
        } else {
          setMySales([]);
        }
      }

    } catch (error) {
      console.error('Error fetching vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateApiKey = async () => {
    try {
      const newKey = 'mk_' + Math.random().toString(36).substring(2, 15);
      const { error } = await supabase
        .from('vendor_settings')
        .update({ api_key_hash: 'simulated_hash' })
        .eq('user_id', user?.id);

      if (error) throw error;
      Alert.alert("API Key Generated", `Save this key safely. It will not be shown again:\n\n${newKey}`);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to generate API key.");
    }
  };

  const toggleStockStatus = async (productId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_in_stock: !currentStatus })
        .eq('id', productId);

      if (error) throw error;
      
      setMyProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_in_stock: !currentStatus } : p
      ));
    } catch (error: any) {
      console.error('Error toggling stock status:', error);
      Alert.alert("Error", error.message || "Could not update stock status.");
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setProductIdToDelete(productId);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!productIdToDelete) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productIdToDelete);

      if (error) throw error;
      
      setMyProducts(prev => prev.filter(p => p.id !== productIdToDelete));
      setDeleteModalVisible(false);
      setProductIdToDelete(null);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      Alert.alert("Error", error.message || "Could not delete product.");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      setMySales(prev => prev.map(sale => 
        sale.orders.id === orderId ? { ...sale, orders: { ...sale.orders, status: newStatus } } : sale
      ));
      
      Alert.alert("Success", `Order status updated to ${newStatus.toUpperCase()}`);
    } catch (error: any) {
      console.error('Error updating order status:', error);
      Alert.alert("Error", error.message || "Could not update order status.");
    }
  };

  const handleCSVImport = async () => {
    if (!vendorSettings?.vendor_id) {
      Alert.alert("Error", "Vendor account not fully initialized. Please contact support.");
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const response = await fetch(fileUri);
      const csvText = await response.text();

      setLoading(true);

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const { data, errors } = results;
          
          if (errors.length > 0) {
            Alert.alert("CSV Error", `Issue parsing file: ${errors[0].message}`);
            setLoading(false);
            return;
          }

          if (data.length === 0) {
            Alert.alert("Empty File", "The CSV file contains no data rows.");
            setLoading(false);
            return;
          }

          const productsToInsert = data.map((row: any) => ({
            vendor_id: vendorSettings.vendor_id,
            name: row.name || row.Name,
            category_name: row.category_name || row.Category || 'Gold',
            product_code: row.product_code || row.SKU || row.Code,
            image_url: row.image_url || row.Image || '',
            gross_weight: parseFloat(row.gross_weight || row.Weight || 0),
            gold_weight: parseFloat(row.gold_weight || row.NetWeight || 0),
            purity: row.purity || row.Purity || '22K',
            metal_color: row.metal_color || row.Color || 'Yellow',
            base_price_usd: parseFloat(row.base_price_usd || row.Price || 0),
            stock_quantity: parseInt(row.stock_quantity || row.Stock || 0),
            sourcing_cost: parseFloat(row.sourcing_cost || row.Cost || 0),
            metal_price_usd: parseFloat(row.metal_price_usd || row.MetalPrice || 0),            va_making_usd: parseFloat(row.va_making_usd || row.Making || 0),
            stone_beads_usd: parseFloat(row.stone_beads_usd || row.StonePrice || 0),
            tax_usd: parseFloat(row.tax_usd || row.Tax || 0),
            popularity: 0,
            rating: 0
          }));

          const invalidRows = productsToInsert.filter(p => !p.name || !p.product_code || p.base_price_usd <= 0);
          if (invalidRows.length > 0) {
            Alert.alert("Validation Error", `Found ${invalidRows.length} rows with invalid data.`);
            setLoading(false);
            return;
          }

          const { error: insertError } = await supabase.from('products').insert(productsToInsert);

          if (insertError) {
            Alert.alert("Upload Failed", insertError.message);
          } else {
            Alert.alert("Success", `Successfully imported ${productsToInsert.length} masterpieces!`);
            fetchVendorData();
          }
          setLoading(false);
        }
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to process CSV file.");
      setLoading(false);
    }
  };

  const renderProductItem = (item: Product) => (
    <View key={item.id} style={[
      styles.productCard, 
      isMobile && { width: isSmallMobile ? '100%' : '47%' },
      isDeleteMode && styles.deleteModeCard
    ]}>
      <OptimizedImage url={(item as any).image_url} style={styles.productImage} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.stockRow}>
          <Text style={[styles.productStock, !(item as any).is_in_stock && styles.outOfStockText]}>
            {(item as any).is_in_stock ? 'IN STOCK' : 'OUT OF STOCK'}
          </Text>
          <TouchableOpacity 
            style={styles.toggleBtn}
            onPress={() => toggleStockStatus(item.id, (item as any).is_in_stock)}
          >
            <Text style={styles.toggleBtnText}>TOGGLE</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>{formatPrice(item.price, countryCode)}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.editBtn}
              onPress={() => navigation.navigate('AddProduct', { product: item, vendorId: item.vendorId || vendorSettings?.vendor_id || '' })}
            >
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
            {isDeleteMode ? (
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleDeleteProduct(item.id)}
              >
                <Text style={styles.deleteBtnText}>REMOVE</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );

  const renderOrderListItem = (sale: any) => (
    <View key={sale.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>ORDER: {sale.orders.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>{new Date(sale.orders.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, { borderColor: sale.orders.status === 'delivered' ? '#4CAF50' : '#D4AF37' }]}>
          <Text style={[styles.statusText, { color: sale.orders.status === 'delivered' ? '#4CAF50' : '#D4AF37' }]}>
            {sale.orders.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={styles.orderBody}>
        <Text style={styles.itemTitle}>{sale.quantity}x {myProducts.find(p => p.id === sale.product_id)?.name || 'Product'}</Text>
        <Text style={styles.orderAmount}>Amount: {formatPrice(sale.price_at_purchase * sale.quantity, countryCode)}</Text>
      </View>
      <View style={[styles.actionRow, isSmallMobile && { flexDirection: 'column' }]}>
        <TouchableOpacity style={styles.statusActionBtn} onPress={() => updateOrderStatus(sale.orders.id, 'processing')}>
          <Text style={styles.statusActionText}>PROCESS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statusActionBtn} onPress={() => updateOrderStatus(sale.orders.id, 'shipped')}>
          <Text style={styles.statusActionText}>SHIP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.statusActionBtn, { borderColor: '#4CAF50' }]} onPress={() => updateOrderStatus(sale.orders.id, 'delivered')}>
          <Text style={[styles.statusActionText, { color: '#4CAF50' }]}>DELIVER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.contentWrapper}>
            <View style={[styles.vendorHeader, isMobile && { padding: 20 }]}>
              <Text style={[styles.vendorTitle, isMobile && { fontSize: 22 }]}>Store Host Portal</Text>
              <Text style={styles.vendorSubtitle}>{vendorSettings?.business_name || 'Moksha Jewels Host Store'}</Text>
              
              {__DEV__ && !vendorSettings?.vendor_id && !loading ? (
                <TouchableOpacity 
                  style={styles.devLinkBtn}
                  onPress={async () => {
                    try {
                      setLoading(true);
                      const { data: vData } = await supabase.from('vendors').select('id').limit(1).single();
                      if (vData) {
                        await supabase.from('vendor_settings').update({ vendor_id: vData.id }).eq('user_id', user?.id);
                        Alert.alert("Development Link", "Successfully linked to a mock vendor for testing.");
                        fetchVendorData();
                      }
                    } catch (e) {
                      console.error("Failed to dev-link:", e);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <Text style={styles.devLinkBtnText}>DEV: QUICK LINK TO VENDOR</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.tabBarContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
                <TouchableOpacity style={[styles.tab, activeTab === 'products' && styles.activeTab, isMobile && { minWidth: 120 }]} onPress={() => setActiveTab('products')}>
                  <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'orders' && styles.activeTab, isMobile && { minWidth: 120 }]} onPress={() => setActiveTab('orders')}>
                  <Text style={[styles.tabText, activeTab === 'orders' && styles.activeTabText]}>Orders</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'm2m' && styles.activeTab, isMobile && { minWidth: 120 }]} onPress={() => setActiveTab('m2m')}>
                  <Text style={[styles.tabText, activeTab === 'm2m' && styles.activeTabText]}>M2M API</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {loading ? (
              <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 50 }} />
            ) : (
              <View style={styles.content}>
                {activeTab === 'overview' ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Partner Overview</Text>
                    <View style={styles.statsGrid}>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total Revenue</Text>
                        <Text style={styles.statValue}>{formatPrice(totalRevenue, countryCode)}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Orders</Text>
                        <Text style={styles.statValue}>{totalOrders}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Active Products</Text>
                        <Text style={styles.statValue}>{activeProductsCount}</Text>
                      </View>
                      <View style={[styles.statCard, lowStockCount > 0 && { borderColor: '#ff4444', backgroundColor: 'rgba(255, 68, 68, 0.05)' }]}>
                        <Text style={styles.statLabel}>Low Stock Alerts</Text>
                        <Text style={[styles.statValue, lowStockCount > 0 && { color: '#ff4444' }]}>{lowStockCount}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {activeTab === 'products' ? (
                  <View style={styles.section}>
                    <View style={[styles.rowBetween, isSmallMobile && { flexDirection: 'column', alignItems: 'flex-start', gap: 15 }]}>
                      <Text style={styles.sectionTitle}>My Inventory</Text>
                      <View style={[styles.headerActions, isSmallMobile && { width: '100%', justifyContent: 'space-between' }]}>
                        <TouchableOpacity 
                          style={[styles.addBtn, { marginRight: 8, borderColor: isDeleteMode ? '#ff4444' : '#aaa' }]} 
                          onPress={() => setIsDeleteMode(!isDeleteMode)}
                        >
                          <Text style={[styles.addBtnText, { color: isDeleteMode ? '#ff4444' : '#aaa' }]}>
                            {isDeleteMode ? 'EXIT MANAGE' : 'MANAGE'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.addBtn, { marginRight: 8, borderColor: '#aaa' }]} onPress={handleCSVImport}>
                          <Text style={[styles.addBtnText, { color: '#aaa' }]}>IMPORT CSV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddProduct', { vendorId: vendorSettings?.vendor_id })}>
                          <Text style={styles.addBtnText}>+ NEW ITEM</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.searchContainer}>
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search your collection..."
                        placeholderTextColor="#666"
                        value={productSearchQuery}
                        onChangeText={setProductSearchQuery}
                      />
                    </View>

                    {myProducts.length === 0 ? (
                      <Text style={styles.emptyText}>No products listed.</Text>
                    ) : (
                      <View style={styles.grid}>
                        {myProducts
                          .filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                                       (p as any).product_code?.toLowerCase().includes(productSearchQuery.toLowerCase()))
                          .map(renderProductItem)}
                      </View>
                    )}
                  </View>
                ) : null}

                {activeTab === 'orders' ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sales Activity</Text>
                    {mySales.length === 0 ? (
                      <Text style={styles.emptyText}>No sales recorded yet.</Text>
                    ) : (
                      <View style={styles.orderList}>
                        {mySales.map(renderOrderListItem)}
                      </View>
                    )}
                  </View>
                ) : null}

                {activeTab === 'm2m' ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>API Integration</Text>
                    <View style={styles.m2mCard}>
                      <Text style={styles.m2mLabel}>Endpoint</Text>
                      <View style={styles.codeBlock}><Text style={styles.codeText}>https://api.mokshajewels.com/v1/sync</Text></View>
                      <TouchableOpacity style={styles.apiKeyBtn} onPress={generateApiKey}>
                        <Text style={styles.apiKeyBtnText}>Generate API Key</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          </View>
          <Footer />
        </ScrollView>
      </KeyboardAvoidingView>

      {deleteModalVisible ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Delete</Text>
            <Text style={styles.modalMessage}>Are you sure you want to remove this masterpiece from your collection?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => {
                  setDeleteModalVisible(false);
                  setProductIdToDelete(null);
                }}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.confirmBtn]} 
                onPress={confirmDelete}
              >
                <Text style={styles.confirmBtnText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#291c0e' },
  scrollContent: { flexGrow: 1 },
  contentWrapper: { flex: 1 },
  vendorHeader: { padding: 40, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.15)' },
  vendorTitle: { fontFamily: 'TrajanPro', fontSize: 28, color: '#D4AF37', letterSpacing: 2, marginBottom: 5 },
  vendorSubtitle: { color: '#888', fontSize: 14, fontStyle: 'italic' },
  devLinkBtn: { marginTop: 15, paddingHorizontal: 15, paddingVertical: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#D4AF37', borderRadius: 4 },
  devLinkBtnText: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold' },
  tabBarContainer: { backgroundColor: 'rgba(212, 175, 55, 0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(212, 175, 55, 0.1)' },
  tabBar: { flexDirection: 'row' },
  tab: { flex: 1, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#D4AF37' },
  tabText: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  activeTabText: { color: '#D4AF37' },
  content: { padding: 20, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  section: { marginBottom: 40 },
  sectionTitle: { fontFamily: 'TrajanPro', fontSize: 20, color: '#D4AF37', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 20 },
  statCard: { flex: 1, minWidth: 150, backgroundColor: '#3d2b1a', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#4a3520' },
  statLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', fontFamily: 'TrajanPro' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  searchContainer: { marginBottom: 20 },
  searchInput: { backgroundColor: '#1a1108', borderWidth: 1, borderColor: '#4a3520', borderRadius: 6, padding: 12, color: '#fff', fontSize: 14 },
  productCard: { width: Platform.OS === 'web' ? '23%' : '47%', backgroundColor: '#3d2b1a', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#4a3520' },
  deleteModeCard: { borderColor: '#ff4444', borderWidth: 1.5 },
  productImage: { width: '100%', height: 150, resizeMode: 'cover' },
  productInfo: { padding: 12 },
  productName: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  productStock: { color: '#aaa', fontSize: 10, marginBottom: 4 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPrice: { color: '#D4AF37', fontSize: 12, fontWeight: 'bold' },
  editBtn: { padding: 4, borderWidth: 1, borderColor: '#D4AF37', borderRadius: 4, paddingHorizontal: 6 },
  editBtnText: { color: '#D4AF37', fontSize: 8, fontWeight: 'bold' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#ff4444', fontSize: 9, fontWeight: 'bold' },
  addBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#D4AF37', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
  addBtnText: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold' },
  m2mCard: { backgroundColor: '#3d2b1a', padding: 25, borderRadius: 12, borderWidth: 1, borderColor: '#4a3520' },
  m2mLabel: { color: '#D4AF37', fontSize: 12, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  codeBlock: { backgroundColor: '#1a1108', padding: 15, borderRadius: 6, marginBottom: 25 },
  codeText: { color: '#00ff00', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
  apiKeyBtn: { backgroundColor: '#D4AF37', paddingVertical: 15, borderRadius: 6, alignItems: 'center' },
  apiKeyBtnText: { color: '#000', fontWeight: 'bold', textTransform: 'uppercase' },
  emptyText: { color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 40 },
  stockRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  outOfStockText: { color: '#ff4444' },
  toggleBtn: { backgroundColor: 'rgba(212, 175, 55, 0.1)', borderWidth: 1, borderColor: '#D4AF37', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  toggleBtnText: { color: '#D4AF37', fontSize: 8, fontWeight: 'bold' },
  orderList: { gap: 15 },
  orderCard: { backgroundColor: '#3d2b1a', borderRadius: 8, padding: 15, borderWidth: 1, borderColor: '#4a3520' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  orderId: { color: '#fff', fontSize: 12, fontWeight: 'bold', fontFamily: 'TrajanPro' },
  orderDate: { color: '#888', fontSize: 10 },
  statusBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: 'bold' },
  orderBody: { marginBottom: 15 },
  itemTitle: { color: '#fff', fontSize: 14, marginBottom: 4 },
  orderAmount: { color: '#aaa', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  statusActionBtn: { flex: 1, borderWidth: 1, borderColor: '#D4AF37', paddingVertical: 8, borderRadius: 4, alignItems: 'center' },
  statusActionText: { color: '#D4AF37', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: '#3d2b1a', padding: 30, borderRadius: 12, borderWidth: 1, borderColor: '#D4AF37', width: '90%', maxWidth: 400, alignItems: 'center' },
  modalTitle: { fontFamily: 'TrajanPro', fontSize: 20, color: '#D4AF37', marginBottom: 15 },
  modalMessage: { color: '#fff', textAlign: 'center', lineHeight: 22, marginBottom: 25, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 15, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: 'center', borderWidth: 1 },
  cancelBtn: { borderColor: '#888' },
  confirmBtn: { borderColor: '#ff4444', backgroundColor: 'rgba(255, 68, 68, 0.1)' },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 12 },
  confirmBtnText: { color: '#ff4444', fontWeight: 'bold', fontSize: 12 }
});

export default VendorDashboardScreen;
