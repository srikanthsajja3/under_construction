import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Platform } from 'react-native';
import { Product } from '../data/products';
import { useAuth } from './AuthContext';
import { supabase } from '../../supabase';

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  cartTotal: number;
  cartCount: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'moksha_jewels_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to map DB response to CartItem
  const mapDbToCartItem = useCallback((item: any): CartItem | null => {
    const product = item?.product;
    if (!product) return null;
    const dbPrice = parseFloat(product.base_price_usd || product.price || product.prc_amount || product.cost_price || 0);
    return {
      id: product.id,
      name: product.name || 'Moksha Masterpiece',
      category: product.category_name || product.category || 'Uncategorized',
      image: product.image_url || product.image || 'https://tnvdmftovccgfrllaffq.supabase.co/storage/v1/object/public/products/logo.jpg',
      productCode: product.product_code || product.productCode || `MJ-${product.id ? product.id.slice(0, 6) : '000000'}`,
      grossWeight: parseFloat(product.gross_weight || product.grossWeight || 0),
      goldWeight: parseFloat(product.gold_weight || product.goldWeight || 0),
      purity: product.purity || '22K',
      metalColor: product.metal_color || product.metalColor || 'Yellow Gold',
      price: dbPrice > 0 ? dbPrice : 1000,
      priceBreakup: {
        metal: parseFloat(product.metal_price_usd || product.priceBreakup?.metal || 0),
        vaMaking: parseFloat(product.va_making_usd || product.priceBreakup?.vaMaking || 0),
        stoneBeads: parseFloat(product.stone_beads_usd || product.priceBreakup?.stoneBeads || 0),
        tax: parseFloat(product.tax_usd || product.priceBreakup?.tax || 0),
      },
      rating: parseFloat(product.rating || 4.8),
      popularity: parseInt(product.popularity || 100),
      createdAt: product.created_at || new Date().toISOString(),
      quantity: item.quantity || 1,
    };
  }, []);

  // Load cart (either from DB or Local Storage)
  const loadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        console.log('Fetching cart from Supabase for user:', user.id);
        const { data, error } = await supabase
          .from('cart_items')
          .select('*, product:products(*)')
          .eq('user_id', user.id);

        if (error) throw error;
        if (data) {
          const mapped = data.map(mapDbToCartItem).filter((i): i is CartItem => i !== null);
          setCart(mapped);
        }
      } else {
        if (Platform.OS === 'web') {
          const savedCart = localStorage.getItem(CART_STORAGE_KEY);
          if (savedCart) setCart(JSON.parse(savedCart));
          else setCart([]);
        }
      }
    } catch (error) {
      console.warn('Error loading cart:', error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [user?.id, mapDbToCartItem]);

  // Initial load
  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Sync local to DB
  useEffect(() => {
    const syncLocalCartToDb = async () => {
      if (user?.id && isInitialized && Platform.OS === 'web') {
        try {
          const localCartJson = localStorage.getItem(CART_STORAGE_KEY);
          if (localCartJson) {
            const localCart: CartItem[] = JSON.parse(localCartJson);
            if (localCart.length > 0) {
              for (const item of localCart) {
                await supabase.from('cart_items').upsert({
                  user_id: user.id,
                  product_id: item.id,
                  quantity: item.quantity
                }, { onConflict: 'user_id,product_id' });
              }
              localStorage.removeItem(CART_STORAGE_KEY);
              loadCart();
            }
          }
        } catch (error) {
          console.warn('Sync local cart error:', error);
        }
      }
    };
    syncLocalCartToDb();
  }, [user?.id, isInitialized, loadCart]);

  // Local persistence
  useEffect(() => {
    if (!isInitialized || user?.id) return;
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (e) {}
    }
  }, [cart, isInitialized, user?.id]);

  const addToCart = useCallback(async (product: Product) => {
    if (!product || !product.id) return;

    // 1. Optimistically update local cart state immediately
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    // 2. Persist to DB asynchronously if user is logged in
    if (user?.id) {
      try {
        const existingItem = cart.find(item => item.id === product.id);
        const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
        const { error } = await supabase
          .from('cart_items')
          .upsert({ user_id: user.id, product_id: product.id, quantity: newQuantity }, { onConflict: 'user_id,product_id' });
        if (error) {
          console.warn('Add to cart Supabase error:', error.message);
        }
      } catch (error) {
        console.warn('Add to cart exception:', error);
      }
    }
  }, [user?.id, cart]);

  const removeFromCart = useCallback(async (productId: string) => {
    if (user?.id) {
      try {
        const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId);
        if (!error) loadCart();
      } catch (error) {
        console.warn('Remove from cart error:', error);
      }
    } else {
      setCart(prev => prev.filter(item => item.id !== productId));
    }
  }, [user?.id, loadCart]);

  const updateQuantity = useCallback(async (productId: string, quantity: number) => {
    if (quantity <= 0) { await removeFromCart(productId); return; }
    if (user?.id) {
      try {
        const { error } = await supabase.from('cart_items').update({ quantity }).eq('user_id', user.id).eq('product_id', productId);
        if (!error) loadCart();
      } catch (error) {
        console.warn('Update quantity error:', error);
      }
    } else {
      setCart(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
    }
  }, [user?.id, removeFromCart, loadCart]);

  const clearCart = useCallback(async () => {
    if (user?.id) {
      try {
        const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
        if (!error) setCart([]);
      } catch (error) {
        console.warn('Clear cart error:', error);
      }
    } else {
      setCart([]);
    }
  }, [user?.id]);

  const [serverSummary, setServerSummary] = useState<any>(null);

  const fetchServerCartSummary = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_cart_summary', {
        p_user_id: user.id,
        p_country_code: 'IN',
      });
      if (!error && data) {
        setServerSummary(data);
      }
    } catch (e) {
      console.warn('Failed to fetch server cart summary:', e);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchServerCartSummary();
    }
  }, [user?.id, cart, fetchServerCartSummary]);

  const cartTotal = useMemo(() => {
    if (serverSummary?.grand_total_local !== undefined && serverSummary.grand_total_local > 0) {
      return serverSummary.grand_total_local;
    }
    return cart.reduce((total, item) => total + (item.price || 0) * item.quantity, 0);
  }, [serverSummary, cart]);

  const cartCount = useMemo(() => {
    if (serverSummary?.total_items !== undefined) {
      return serverSummary.total_items;
    }
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [serverSummary, cart]);

  const value = useMemo(() => ({
    cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, isLoading, serverSummary
  }), [cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartCount, isLoading, serverSummary]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) throw new Error('useCart must be used within a CartProvider');
  return context;
};
