import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions, Platform, ActivityIndicator, Animated, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FontAwesome5 } from "@expo/vector-icons";
import OptimizedImage from "./OptimizedImage";
import { Product, fetchProductsFromSupabase, ProductFilters } from "../data/products";
import { useCountry } from "../contexts/CountryContext";
import { formatPrice } from "../utils/currency";
import { FEATURE_FLAGS } from "../config/features";
import { SortOption } from "./CategoryBar";
import { useWishlist } from "../contexts/WishlistContext";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";

interface ProductListProps {
  category: string;
  onSelectProduct: (product: Product) => void;
  sortBy: SortOption;
  searchQuery?: string;
  onPressLogin?: () => void;
  filters?: ProductFilters;
  ListHeaderComponent?: ((count: number) => React.ReactElement | null) | React.ComponentType<any> | React.ReactElement | null;
  onScroll?: (event: any) => void;
  stickyHeaderIndices?: number[];
  onClearFilters?: () => void;
  hasSidebar?: boolean;
  userColumns?: number;
  horizontalMargin?: number;
}

const AnimatedProductCard = React.memo(({ item, itemWidth, onSelectProduct, handleWishlistToggle, isInWishlist, formatPrice, countryCode, addedToCartId, handleAddToCart, index, shouldLoad }: any) => {
  const [hovered, setHovered] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const useNativeDriver = Platform.OS !== 'web';
  const navigation = useNavigation<any>();

  const images = useMemo(() => {
    return [item.image, ...(item.galleryUrls || [])].filter(Boolean);
  }, [item.image, item.galleryUrls]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: Math.min(index, 8) * 100, 
        useNativeDriver,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: Math.min(index, 8) * 100,
        useNativeDriver,
      })
    ]).start();
  }, [index, fadeAnim, translateY, useNativeDriver]);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const onPressAddToCart = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver })
    ]).start();
    handleAddToCart(item);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], width: itemWidth }}>
      <TouchableOpacity 
        style={[
          styles.productCard, 
          { width: '100%' },
          Platform.OS === 'web' && hovered && styles.productCardHovered
        ]}
        activeOpacity={0.8}
        onPress={() => onSelectProduct(item)}
        // @ts-ignore
        onMouseEnter={() => setHovered(true)}
        // @ts-ignore
        onMouseLeave={() => setHovered(false)}
      >
        <View style={styles.imageContainer}>
          <OptimizedImage 
            url={images[0]} 
            style={styles.productImage} 
            shouldLoad={shouldLoad}
          />
          {images.length > 1 && (
            <View 
              style={[
                styles.hoverImageContainer,
                { opacity: hovered ? 1 : 0 }
              ]}
            >
              <OptimizedImage 
                url={images[1]} 
                style={styles.productImage} 
                shouldLoad={shouldLoad}
              />
            </View>
          )}

          <TouchableOpacity 
            style={styles.wishlistIcon} 
            onPress={(e) => {
              e.stopPropagation();
              handleWishlistToggle(item.id);
            }}
          >
            <Text style={[styles.heart, isInWishlist && styles.heartActive]}>
              {isInWishlist ? "♥" : "♡"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productCodeBadge}>{item.productCode || item.sku}</Text>
          {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.productPrice}>{formatPrice(item.price, countryCode)}</Text> : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id && 
         prev.shouldLoad === next.shouldLoad &&
         prev.isInWishlist === next.isInWishlist &&
         prev.addedToCartId === next.addedToCartId &&
         prev.itemWidth === next.itemWidth &&
         prev.countryCode === next.countryCode;
});

const ProductList: React.FC<ProductListProps> = ({ 
  category, 
  onSelectProduct, 
  sortBy, 
  searchQuery = "", 
  onPressLogin,
  filters = {},
  ListHeaderComponent,
  onScroll: onScrollProp,
  stickyHeaderIndices,
  onClearFilters,
  hasSidebar = false,
  userColumns,
  horizontalMargin
}) => {
  const { width } = useWindowDimensions();
  const { countryCode } = useCountry();
  const { user } = useAuth();
  const { isInWishlist, addToWishlist, removeFromWishlist, wishlist } = useWishlist();
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const [error, setError] = useState<string | null>(null);
  const [addedToCartId, setAddedToCartId] = useState<string | null>(null);

  const handleAddToCart = (product: Product) => {
    addToCart(product);
    setAddedToCartId(product.id);
    setTimeout(() => {
      setAddedToCartId(null);
    }, 2000);
  };

  const wishlistKey = useMemo(() => wishlist.join(','), [wishlist]);

  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      setHasMore(true);
      try {
        let data: Product[] = [];
        if (category === "Wishlist") {
          const all = await fetchProductsFromSupabase("All");
          data = all.filter(p => wishlist.includes(p.id));
          if (isMounted) setHasMore(false);
        } else {
          data = await fetchProductsFromSupabase(category, 1, PAGE_SIZE);
          if (isMounted) setHasMore(data.length >= PAGE_SIZE);
        }
        if (isMounted) {
          setProducts(data);
        }
      } catch (err) {
        console.error("Error loading products:", err);
        if (isMounted) setError("Failed to connect to the gallery.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProducts();
    return () => {
      isMounted = false;
    };
  }, [category, category === "Wishlist" ? wishlistKey : null]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || category === "Wishlist") return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const nextBatch = await fetchProductsFromSupabase(category, nextPage, PAGE_SIZE);
      if (nextBatch && nextBatch.length > 0) {
        setProducts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNew = nextBatch.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNew];
        });
        setPage(nextPage);
        if (nextBatch.length < PAGE_SIZE) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more products:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, category, page]);

  const filteredAndSortedProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => {
        const nameMatch = p.name?.toLowerCase().includes(q);
        const codeMatch = p.productCode?.toLowerCase().includes(q);
        const skuMatch = p.sku?.toLowerCase().includes(q);
        const barcodeMatch = p.barcode?.toLowerCase().includes(q);
        const huidMatch = p.huid?.toLowerCase().includes(q);
        const catMatch = p.category?.toLowerCase().includes(q);
        const typeMatch = p.type?.toLowerCase().includes(q);
        const purityMatch = p.purity?.toLowerCase().includes(q);
        const gemMatch = p.gemstoneType?.toLowerCase().includes(q);
        const stonesMatch = p.stonesInDetail?.some(st => st.name?.toLowerCase().includes(q));
        return nameMatch || codeMatch || skuMatch || barcodeMatch || huidMatch || catMatch || typeMatch || purityMatch || gemMatch || stonesMatch;
      });
    }

    if (filters.subCategory) {
      const rawSub = filters.subCategory.toLowerCase();
      if (rawSub.includes(':')) {
        const [mainSubRaw, subOptionRaw] = rawSub.split(':');
        const mainSub = mainSubRaw.toLowerCase();
        const subOption = subOptionRaw.toLowerCase();
        result = result.filter(p => {
          const matchesMain = (p.type?.toLowerCase() === mainSub) || 
                              (p.category?.toLowerCase() === mainSub) ||
                              (p.collection?.toLowerCase() === mainSub) ||
                              (p.name?.toLowerCase().includes(mainSub)) ||
                              (mainSub === 'accessories') ||
                              (mainSub === 'other') ||
                              (mainSub === 'lockets' && (p.type?.toLowerCase() === 'lockets / pendents' || p.collection?.toLowerCase() === 'lockets / pendents')) ||
                              (mainSub === 'earrings' && ['studs', 'jumkies', 'fancy'].includes(p.type?.toLowerCase() || '')) ||
                              (mainSub === 'necklace' && ['necklace short/medium', 'necklace set'].includes(p.type?.toLowerCase() || '')) ||
                              (mainSub === 'bracelet' && ['plain', 'stones'].includes(p.type?.toLowerCase() || '')) ||
                              (mainSub === 'bangles' && ['plain', 'stones'].includes(p.type?.toLowerCase() || ''));
                              
          const matchesOption = (p.gender?.toLowerCase() === subOption) ||
                                (p.type?.toLowerCase() === subOption) ||
                                (p.category?.toLowerCase() === subOption) ||
                                (p.collection?.toLowerCase() === subOption) ||
                                (p.name?.toLowerCase().includes(subOption));
          return matchesMain && matchesOption;
        });
      } else {
        const sub = rawSub.toLowerCase();
        result = result.filter(p => {
          const typeLower = (p.type || '').toLowerCase();
          const catLower = (p.category || '').toLowerCase();
          const nameLower = (p.name || '').toLowerCase();
          
          if (sub === 'all items' || sub === 'all') return true;
          if (sub === 'ear rings' || sub === 'earrings' || sub === 'hangings') {
            return ['ear rings', 'earrings', 'hangings', 'studs', 'jumkies', 'fancy', 'tops', 'jumka', 'bali'].includes(typeLower) || nameLower.includes('top') || nameLower.includes('jumka') || nameLower.includes('bali') || nameLower.includes('hanging');
          }
          if (sub === 'necklaces' || sub === 'necklace') {
            return ['necklaces', 'necklace', 'pendants', 'choker', 'haaram', 'lockets / pendents'].includes(typeLower) || nameLower.includes('necklace') || nameLower.includes('haaram') || nameLower.includes('pendant') || nameLower.includes('choker') || nameLower.includes('mala');
          }
          if (sub === 'bangles' || sub === 'bangle') {
            return ['bangles', 'bangle', 'kada', 'bracelete', 'bracelet'].includes(typeLower) || nameLower.includes('bangle') || nameLower.includes('kada') || nameLower.includes('bracelete') || nameLower.includes('bracelet');
          }
          if (sub === 'chains' || sub === 'chain') {
            return ['chains', 'chain', 'black beeds', 'blackbeeds'].includes(typeLower) || nameLower.includes('chain') || nameLower.includes('black beed') || nameLower.includes('blackbeed');
          }
          if (sub === 'rings' || sub === 'ring') {
            return ['rings', 'ring'].includes(typeLower) || nameLower.includes('ring');
          }
          if (sub === 'bajubands' || sub === 'bajuband') {
            return ['bajubands', 'bajuband', 'vaddanam'].includes(typeLower) || nameLower.includes('bajuband') || nameLower.includes('vaddanam');
          }

          const matchesOther = (sub === 'other' || sub === 'accessories') && 
                               ['coins', 'bhajubandh', 'watch', 'tikka'].includes(typeLower);
          return (typeLower === sub) || 
                 (catLower === sub) ||
                 (p.collection?.toLowerCase() === sub) ||
                 (nameLower.includes(sub)) ||
                 (p.gender?.toLowerCase() === sub) ||
                 matchesOther;
        });
      }
    }

    if (filters.minPrice !== undefined) {
      result = result.filter(p => p.price >= (filters.minPrice || 0));
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter(p => p.price <= (filters.maxPrice || Infinity));
    }
    if (filters.purity && filters.purity.length > 0) {
      result = result.filter(p => {
        const itemPurityNorm = (p.purity || '').replace(/\s+/g, '').replace('KT', 'K').toUpperCase();
        return filters.purity?.some(fp => fp.replace(/\s+/g, '').replace('KT', 'K').toUpperCase() === itemPurityNorm);
      });
    }
    if (filters.metalColor && filters.metalColor.length > 0) {
      result = result.filter(p => filters.metalColor?.includes(p.metalColor));
    }

    switch (sortBy) {
      case "popularity": result.sort((a, b) => b.popularity - a.popularity); break;
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "latest": result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case "price_low": result.sort((a, b) => a.price - b.price); break;
      case "price_high": result.sort((a, b) => b.price - a.price); break;
      case "weight_low": result.sort((a, b) => a.grossWeight - b.grossWeight); break;
      case "weight_high": result.sort((a, b) => b.grossWeight - a.grossWeight); break;
    }
    return result;
  }, [products, sortBy, searchQuery, filters]);

  const handleWishlistToggle = async (productId: string) => {
    if (!user) { onPressLogin?.(); return; }
    if (isInWishlist(productId)) await removeFromWishlist(productId);
    else await addToWishlist(productId);
  };

  const gridWidth = width - (hasSidebar ? 284 : 0);

  const isMobile = width < 768;
  const spacing = isMobile ? 12 : (Platform.OS === 'web' ? 14 : 14);
  const padding = horizontalMargin !== undefined 
    ? horizontalMargin 
    : (isMobile ? 16 : Math.round(gridWidth * 0.10));
  const containerWidth = Platform.OS === 'web' ? Math.min(gridWidth, 2500) : gridWidth;
  const availableWidth = containerWidth - (padding * 2);

  // Default to 4 items per row on desktop web view, 2 on mobile
  let numColumns = isMobile ? 2 : (userColumns || 4);
  numColumns = Math.max(2, numColumns); // Minimum 2 columns

  const itemWidth = (availableWidth - (spacing * (numColumns - 1))) / numColumns;

  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <AnimatedProductCard
      item={item}
      index={index}
      itemWidth={itemWidth}
      onSelectProduct={onSelectProduct}
      handleWishlistToggle={handleWishlistToggle}
      isInWishlist={isInWishlist(item.id)}
      formatPrice={formatPrice}
      countryCode={countryCode}
      addedToCartId={addedToCartId}
      handleAddToCart={handleAddToCart}
      shouldLoad={true}
    />
  );

  return (
    <FlatList
      data={filteredAndSortedProducts}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      numColumns={numColumns}
      key={`${numColumns}`}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.list, 
        { paddingHorizontal: padding },
        Platform.OS === 'web' && { alignSelf: 'center', width: '100%', maxWidth: 2500 }
      ]}
      columnWrapperStyle={numColumns > 1 ? { gap: spacing } : undefined}
      ListHeaderComponent={() => (
        <>
          {ListHeaderComponent ? (
            <View style={{ 
              marginHorizontal: -padding,
              zIndex: 9999,
              position: 'relative',
              overflow: 'visible'
            }}>
              {typeof ListHeaderComponent === 'function' && !React.isValidElement(ListHeaderComponent)
                ? (ListHeaderComponent as any)(filteredAndSortedProducts.length)
                : React.isValidElement(ListHeaderComponent)
                ? ListHeaderComponent
                : React.createElement(ListHeaderComponent as any)}
            </View>
          ) : null}
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {searchQuery ? `Search: ${searchQuery}` : `${category} Collection`}
            </Text>
            <Text style={styles.countText}>{filteredAndSortedProducts.length} Items</Text>
          </View>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text style={styles.loadingText}>Fetching Masterpieces...</Text>
            </View>
          )}
          {error && (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: "#ff4444" }]}>{error}</Text>
            </View>
          )}
        </>
      )}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No products found matching your criteria.</Text>
          {onClearFilters && (
            <TouchableOpacity 
              style={styles.emptyClearBtn}
              onPress={onClearFilters}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyClearBtnText}>Reset All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      ListFooterComponent={() => (
        hasMore && !loading ? (
          <View style={{ paddingVertical: 30, alignItems: "center", justifyContent: "center" }}>
            {loadingMore ? (
              <>
                <ActivityIndicator size="small" color="#D4AF37" />
                <Text style={{ color: "#D4AF37", fontSize: 11, marginTop: 8, letterSpacing: 1, fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro' }}>
                  Loading more masterpieces...
                </Text>
              </>
            ) : (
              <TouchableOpacity
                style={styles.viewMoreBtn}
                onPress={loadMore}
                activeOpacity={0.8}
              >
                <Text style={styles.viewMoreBtnText}>VIEW MORE PRODUCTS</Text>
                <FontAwesome5 name="chevron-down" size={10} color="#D4AF37" />
              </TouchableOpacity>
            )}
          </View>
        ) : null
      )}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      onScroll={onScrollProp}
      scrollEventThrottle={16}
      stickyHeaderIndices={stickyHeaderIndices}
      windowSize={5}
      initialNumToRender={6}
      maxToRenderPerBatch={20}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    paddingBottom: 40,
    backgroundColor: "#291c0e",
  },
  loadingContainer: {
    padding: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#D4AF37",
    marginTop: 20,
    fontFamily: "TrajanPro",
    fontSize: 14,
    letterSpacing: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 15,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.15)",
  },
  title: {
    fontFamily: "TrajanPro",
    fontSize: 20,
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingTop: 12,
    paddingBottom: 12,
  },
  countText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  productCard: {
    backgroundColor: "#150d05", // Rich dark luxury background
    borderRadius: 4, // Classic straight edges
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.08)",
    ...Platform.select({
      web: {
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }
    })
  },
  productCardHovered: {
    borderColor: 'rgba(212, 175, 55, 0.6)',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 30px rgba(212, 175, 55, 0.12)',
        transform: 'translateY(-6px)',
      }
    } as any)
  },
  hallmarkBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(21, 13, 5, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    borderRadius: 2,
    zIndex: 10,
  },
  hallmarkBadgeText: {
    color: '#D4AF37',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  imageContainer: {
    position: "relative",
    backgroundColor: "#201409",
  },
  productImage: {
    width: "100%",
    aspectRatio: 1, // Square aspect ratio ensures responsive and sharp scaling
  },
  wishlistIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(21, 13, 5, 0.6)",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.25)",
  },
  heart: {
    color: "#fff",
    fontSize: 14,
  },
  heartActive: {
    color: "#D4AF37",
  },
  arBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#D4AF37",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 10px rgba(212, 175, 55, 0.3)',
      }
    } as any)
  },
  arBadgeText: {
    color: "#000",
    fontSize: 8,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  productInfo: {
    padding: Platform.OS === 'web' ? 12 : 8,
    paddingTop: 10,
    alignItems: "flex-start",
  },
  productCodeBadge: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 11,
    fontFamily: "TrajanPro",
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 4,
  },
  productName: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "TrajanPro", // High-end brand font
    marginBottom: 6,
    letterSpacing: 1,
    textAlign: "left",
    height: 36, // Ensures uniform grid card height when name extends to 2 lines
  },
  productWeight: {
    color: "#a8927e", // Elegant muted text
    fontSize: 9.5,
    marginBottom: 8,
    letterSpacing: 0.5,
    textAlign: "left",
  },
  productPrice: {
    color: "#D4AF37",
    fontSize: 13,
    fontFamily: "TrajanPro",
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "left",
    marginBottom: 4, // Added margin to space out the button
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#888",
    fontSize: 14,
    fontStyle: "italic",
    marginBottom: 10,
    textAlign: "center",
  },
  emptyClearBtn: {
    marginTop: 15,
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  emptyClearBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  addToCartBtn: {
    marginTop: 18, // Increased spacing above the button
    width: '100%',
    paddingVertical: 15, // Increased vertical padding for more text breathing room
    paddingHorizontal: 15, // Increased horizontal padding
    borderRadius: 4, // Clean, sharp edges for a high-end luxury look
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
      }
    })
  },
  addToCartBtnHovered: {
    backgroundColor: "#D4AF37",
    borderColor: "#D4AF37",
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)',
      }
    } as any)
  },
  addToCartBtnSuccess: {
    backgroundColor: "#291c0e",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
  },
  addToCartBtnText: {
    color: "#D4AF37",
    fontSize: 10.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
    ...Platform.select({
      web: {
        transition: 'color 0.25s ease',
      }
    })
  },
  addToCartBtnTextHovered: {
    color: "#291c0e",
  },
  addToCartBtnTextSuccess: {
    color: "#D4AF37",
  },
  addedLabelContainer: {
    marginTop: 18,
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  addedLabelText: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
  },
  hoverImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#201409",
    ...Platform.select({
      web: {
        transitionProperty: 'opacity',
        transitionDuration: '0.3s',
        transitionTimingFunction: 'ease-in-out',
      } as any
    })
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'transparent',
    gap: 4,
  },
  actionBtnOutlineText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D4AF37',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
  },
  addToCartBtnCompact: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 4,
    gap: 6,
    width: '100%',
    marginTop: 4,
  },
  addToCartBtnCompactSuccess: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  addToCartBtnCompactText: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
  },
  addToCartBtnCompactTextSuccess: {
    color: '#291c0e',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 4,
    gap: 10,
    marginTop: 10,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.25s ease',
      }
    })
  },
  viewMoreBtnText: {
    color: '#D4AF37',
    fontSize: 11.5,
    fontWeight: 'bold',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
  },
});

export default ProductList;
