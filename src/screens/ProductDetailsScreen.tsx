import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { StyleSheet, View, ScrollView, Text, TouchableOpacity, useWindowDimensions, ViewStyle, Platform, ActivityIndicator, TextInput, Alert, Animated, Modal, SafeAreaView } from "react-native";
import { Image } from "expo-image";
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import ImageViewer from 'react-native-image-zoom-viewer';
import Header from "../components/Header";
import Footer from "../components/Footer";
import OptimizedImage from "../components/OptimizedImage";
import ProductImageGallery from "../components/ProductImageGallery";
import { StoreAvailabilityModal } from "../components/StoreAvailabilityModal";
import { PriceBreakupModal } from "../components/PriceBreakupModal";
import { supabase } from "../../supabase";
import { Product, fetchProductsFromSupabase, PRODUCTS } from "../data/products";
import { useCountry } from "../contexts/CountryContext";
import { formatPrice } from "../utils/currency";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useWishlist } from "../contexts/WishlistContext";

import { useNavigation, useRoute, RouteProp, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/types";

import { useUI } from "../contexts/UIContext";
import { useGoldRate } from "../contexts/GoldRateContext";
import { fetchProductById } from "../data/products";
import { calculateApkEstimate, fetchServerApkEstimate, EstimationResult } from "../utils/apkEstimationEngine";
import { FEATURE_FLAGS } from "../config/features";
import { Linking } from "react-native";

interface ProductDetailsScreenProps {
  scrollY?: Animated.Value;
}

const ProductDetailsScreen: React.FC<ProductDetailsScreenProps> = ({ scrollY: scrollYProp }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetails'>>();
  const [product, setProduct] = useState<Product | null>(route.params?.product || null);
  const [fetchingProduct, setFetchingProduct] = useState(!route.params?.product && !!route.params?.id);
  const { setLoginVisible, setSearchQuery, scrollY: globalScrollY } = useUI();

  const localScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = scrollYProp || globalScrollY || localScrollY;

  const handleMainScroll = (event: any) => {
    // Manually set the value to avoid mapping issues on web
    scrollY.setValue(event.nativeEvent.contentOffset.y);
  };

  useEffect(() => {
    const loadProduct = async () => {
      const routeId = route.params?.id;
      if (routeId && (!product || product.id !== routeId)) {
        setFetchingProduct(true);
        try {
          const fetched = await fetchProductById(routeId);
          setProduct(fetched);
        } catch (err) {
          console.error("Error fetching product:", err);
        } finally {
          setFetchingProduct(false);
        }
      }
    };
    loadProduct();
  }, [route.params?.id]);

  const onBack = () => navigation.goBack();
  const onSelectProduct = (newProduct: Product) => navigation.navigate('ProductDetails', { id: newProduct.id });
  
  const { width, height } = useWindowDimensions();
  const { countryCode } = useCountry();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const scrollRef = useRef<any>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [suiteItems, setSuiteItems] = useState<Product[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [showAddedMsg, setShowAddedMsg] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasPurchased, setHasPurchased] = useState(false);

  // Dynamic Gold Rate Purity & Pricing states
  const { rates, getLocalizedRate } = useGoldRate();
  const [selectedPurity, setSelectedPurity] = useState<string>("22K");
  const [engravingText, setEngravingText] = useState<string>("");
  const [priceAlertSubscribed, setPriceAlertSubscribed] = useState<boolean>(false);
  const [selectedSize, setSelectedSize] = useState<number>(7);
  const [isSizeFinderVisible, setIsSizeFinderVisible] = useState<boolean>(false);
  const [isStoreCheckVisible, setIsStoreCheckVisible] = useState<boolean>(false);
  const [isSuiteModalVisible, setIsSuiteModalVisible] = useState<boolean>(false);
  const [sizeFinderDiameter, setSizeFinderDiameter] = useState<number>(17.3); // Default size 7 has 17.3mm diameter
  const [addGiftWrapping, setAddGiftWrapping] = useState<boolean>(false);
  const [giftMessage, setGiftMessage] = useState<string>("");
  const [giftOptionsExpanded, setGiftOptionsExpanded] = useState<boolean>(false);
  const [isPriceBreakupVisible, setIsPriceBreakupVisible] = useState<boolean>(false);

  const jewelryType = useMemo(() => {
    if (!product) return "";
    return (product.type || product.name || '').toLowerCase();
  }, [product]);

  const suiteText = useMemo(() => {
    if (!product) return { title: "Complete the Suite", subtitle: "Pair this masterpiece with coordinating items designed to match" };
    
    const currentLowerName = product.name.toLowerCase();
    const currentType = (product.type || "").toLowerCase();
    
    const isEarring = currentType.includes("earring") || currentLowerName.includes("earring") || currentLowerName.includes("studs");
    const isNecklace = currentType.includes("necklace") || currentLowerName.includes("necklace") || currentType.includes("pendant") || currentLowerName.includes("pendant");
    const isRing = currentType.includes("ring") || currentLowerName.includes("ring");
    const isBracelet = currentType.includes("bracelet") || currentLowerName.includes("bracelet") || currentType.includes("bangle") || currentLowerName.includes("bangle") || currentLowerName.includes("bangles");
    
    if (isEarring) {
      return {
        title: "Complete the Look",
        subtitle: "Pair these earrings with a coordinating necklace designed to match"
      };
    } else if (isNecklace) {
      return {
        title: "Complete the Look",
        subtitle: "Pair this necklace with coordinating earrings designed to match"
      };
    } else if (isRing) {
      return {
        title: "Complete the Suite",
        subtitle: "Pair this ring with coordinating bracelets designed to match"
      };
    } else if (isBracelet) {
      return {
        title: "Complete the Suite",
        subtitle: "Pair this bracelet with a coordinating ring designed to match"
      };
    }
    
    return {
      title: "Complete the Suite",
      subtitle: "Pair this masterpiece with coordinating items designed to match"
    };
  }, [product]);

  useEffect(() => {
    if (product) {
      let p = product.purity || "22K";
      p = p.replace(/\s+/g, "").toUpperCase();
      if (p.endsWith("KT")) p = p.slice(0, -2) + "K";
      setSelectedPurity(p);
    }
  }, [product]);

  const [serverEst, setServerEst] = useState<EstimationResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!product || !selectedPurity) return;

    fetchServerApkEstimate({
      productCode: product.productCode || product.sku || product.name,
      sku: product.sku || product.productCode,
      name: product.name,
      netWt: product.goldWeight || product.netWeight || 0,
      grossWt: product.grossWeight || product.goldWeight || 0,
      purity: selectedPurity,
      wastagePct: product.wastage !== undefined ? product.wastage : 22,
      labourRateOverride: product.labourRate && product.labourRate > 0 ? product.labourRate : undefined,
      labourAmtOverride: product.labourAmt && product.labourAmt > 0 ? product.labourAmt : undefined,
      stones: product.stonesInDetail || []
    }).then(res => {
      if (isMounted && res) {
        setServerEst(res);
      }
    });

    return () => { isMounted = false; };
  }, [product, selectedPurity]);

  const dynamicPriceInfo = useMemo(() => {
    if (!product) return null;

    if (serverEst && serverEst.totalEstimateUSD > 0) {
      const est = serverEst;
      const metalCost = est.goldValue / 83;
      const vaMaking = (est.labourCharges + est.certCharges) / 83;
      const stoneBeads = est.totalStoneValue / 83;
      const tax = est.gstAmount / 83;
      
      let total = est.totalEstimateUSD;
      if (addGiftWrapping) {
        total += 10.00; // Gift wrap fee
      }
      
      return {
        metalCost,
        vaMaking,
        stoneBeads,
        tax,
        subTotal: metalCost + vaMaking + stoneBeads,
        total,
        rawEst: est
      };
    }

    // Authoritative fallback using product priceBreakup parameters when server RPC is pending
    const pb = product.priceBreakup;
    const metalCost = pb?.metal && pb.metal > 0 ? pb.metal : (product.price * 0.85);
    const vaMaking = pb?.vaMaking && pb.vaMaking > 0 ? pb.vaMaking : (product.price * 0.12);
    const stoneBeads = pb?.stoneBeads || 0;
    const tax = pb?.tax && pb.tax > 0 ? pb.tax : (product.price * 0.03);

    let total = product.price;
    if (addGiftWrapping) {
      total += 10.00;
    }

    return {
      metalCost,
      vaMaking,
      stoneBeads,
      tax,
      subTotal: metalCost + vaMaking + stoneBeads,
      total,
      rawEst: null
    };
  }, [product, selectedPurity, addGiftWrapping, serverEst]);

  const handlePriceAlertToggle = () => {
    setPriceAlertSubscribed(prev => !prev);
    Alert.alert(
      !priceAlertSubscribed ? "Alert Set" : "Alert Off",
      !priceAlertSubscribed 
        ? "We'll notify you if the price of this item drops based on live gold market changes!"
        : "You have unsubscribed from price drop notifications for this item."
    );
  };

  const handleShareRegistry = () => {
    Alert.alert(
      "Share Registry Item",
      "Product link copied! Share this with friends or family so they know what you'd like on your registry."
    );
  };

  const handleWhatsAppInquiry = () => {
    if (!product) return;
    const phone = FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER;
    const code = product.productCode || product.sku || product.id;
    const currentPrice = dynamicPriceInfo?.total || product.price;
    const priceText = FEATURE_FLAGS.SHOW_PRICES && currentPrice ? `\nEstimated Price: ${formatPrice(currentPrice, countryCode)}` : '';
    
    let linkText = '';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      linkText = `\nLink: ${window.location.href}`;
    }

    const message = `Namaste Moksha Jewels! I am interested in this masterpiece:\n\n*${product.name}*\nProduct Code: ${code}${priceText}${linkText}\n\nPlease share price, live availability, and custom crafting options.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch(() => {
        Alert.alert("Error", "Could not open WhatsApp.");
      });
    }
  };

  const handleWhatsAppConsultation = () => {
    handleWhatsAppInquiry();
  };

  const allImages = useMemo(() => {
    if (!product || !product.image) return [];
    // Strictly 1 verified image matching the item SKU
    return [product.image];
  }, [product?.image]);

  const isLargeScreen = width > 700;

  const validStonesInDetail = useMemo(() => {
    if (!product?.stonesInDetail || !Array.isArray(product.stonesInDetail)) return [];
    return product.stonesInDetail.filter(st => {
      if (!st || !st.name) return false;
      const lower = st.name.trim().toLowerCase();
      if (lower === 'none' || lower === 'null') return false;
      return true;
    });
  }, [product?.stonesInDetail]);

  const stoneWeightGrams = useMemo(() => {
    if (!product?.grossWeight) return 0;
    const net = product.netWeight || product.goldWeight || 0;
    if (product.grossWeight > net && (product.grossWeight - net) > 0.005) {
      return Number((product.grossWeight - net).toFixed(3));
    }
    return 0;
  }, [product?.grossWeight, product?.netWeight, product?.goldWeight]);

  const thumbnailWidth = 64;
  const thumbnailSpacing = 12;
  const maxWindowHeightConstraint = isLargeScreen ? Math.min(height - 100, 680) : Math.min(width - 32, 450);
  const mainImageWidth = isLargeScreen 
    ? Math.min((width * 0.50 - 20) - (allImages.length > 1 ? (thumbnailWidth + thumbnailSpacing) : 0), maxWindowHeightConstraint)
    : Math.min(width - 32, maxWindowHeightConstraint);

  const contentStyle: ViewStyle = isLargeScreen 
    ? { width: "100%", alignSelf: "flex-start", flexDirection: "row" as const } 
    : { width: "100%" };

  // Generate Image URLs for the ImageViewer
  const viewerImages = useMemo(() => {
    return allImages.map(url => ({ url }));
  }, [allImages]);

  useEffect(() => {
    // Safety check if product is null
    if (!product || !product.id || !product.category) return;

    const loadRecommendations = async () => {
      setLoadingRecs(true);
      try {
        const data = await fetchProductsFromSupabase("All");
        
        // Merge Supabase fetched data with static PRODUCTS catalog as guaranteed fallback
        const allCatalog = [...(data || [])];
        if (PRODUCTS && PRODUCTS.length > 0) {
          PRODUCTS.forEach(p => {
            if (!allCatalog.some(existing => existing.id === p.id)) {
              allCatalog.push(p);
            }
          });
        }
        
        // Find explicitly linked matching products (both directions: direct and reverse)
        const explicitMatches = allCatalog.filter(p => {
          if (p.id === product.id) return false;
          const isDirectMatch = product.matchingProductId && p.id === product.matchingProductId;
          const isReverseMatch = p.matchingProductId && p.matchingProductId === product.id;
          return isDirectMatch || isReverseMatch;
        });

        const finalSuiteItems = explicitMatches;

        // Recommendations: same category products as fallback
        const categoryMates = allCatalog.filter(p => p.category === product.category && p.id !== product.id);
        
        // Other store products as fallback if same category has few items
        const otherStoreProducts = allCatalog.filter(p => p.id !== product.id && p.category !== product.category);

        // Merge suite items, category mates, and general store products, avoiding duplicates
        const combined = [...finalSuiteItems];
        categoryMates.forEach(item => {
          if (!combined.some(c => c.id === item.id)) {
            combined.push(item);
          }
        });
        otherStoreProducts.forEach(item => {
          if (!combined.some(c => c.id === item.id)) {
            combined.push(item);
          }
        });

        setRecommendations(combined.slice(0, 15));
        setSuiteItems(finalSuiteItems.slice(0, 4));
      } catch (err) {
        console.error("Error loading recommendations:", err);
      } finally {
        setLoadingRecs(false);
      }
    };

    loadRecommendations();
  }, [product?.id, product?.category, product?.matchingProductId]);

  useEffect(() => {
    if (!product?.id) return;
    
    const loadReviews = async () => {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*, profiles(full_name)')
          .eq('product_id', product.id)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          setReviews(data);
        }
      } catch (err) {
        console.warn("Error loading reviews:", err);
      }
    };

    const checkPurchase = async () => {
      if (!user?.id || !product?.id) {
        setHasPurchased(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select('id, orders(status)')
          .eq('product_id', product.id)
          .eq('orders.user_id', user.id)
          .eq('orders.status', 'delivered');
        
        if (!error && data && data.length > 0) {
          setHasPurchased(true);
        } else {
          setHasPurchased(false);
        }
      } catch (err) {
        console.warn("Error checking purchase status:", err);
        setHasPurchased(false);
      }
    };

    loadReviews();
    checkPurchase();
  }, [product?.id, user?.id]);

  useEffect(() => {
    // Scroll to top when product changes
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [product?.id]);

  const handleSubmitReview = async () => {
    if (!user) {
      setLoginVisible(true);
      return;
    }
    if (!product?.id) return;
    
    if (!userReview.comment.trim()) {
      Alert.alert("Review Required", "Please share your thoughts on this masterpiece.");
      return;
    }

    setSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          product_id: product.id,
          rating: userReview.rating,
          comment: userReview.comment
        });

      if (error) throw error;
      
      Alert.alert("Thank You", "Your review has been shared with the community.");
      setUserReview({ rating: 5, comment: "" });
      // Refresh reviews
      const { data: updatedReviews } = await supabase
        .from('reviews')
        .select('*, profiles(full_name)')
        .eq('product_id', product.id)
        .order('created_at', { ascending: false });
      if (updatedReviews) setReviews(updatedReviews);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not post review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBuyNow = async () => {
    if (product) {
      const finalPrice = dynamicPriceInfo?.total || product.price || 1000;
      await addToCart({ ...product, price: finalPrice });
    }
    if (!user) {
      setLoginVisible(true);
    } else {
      navigation.navigate('Cart');
    }
  };

  const handleAddToCart = async () => {
    if (product) {
      const finalPrice = dynamicPriceInfo?.total || product.price || 1000;
      await addToCart({ ...product, price: finalPrice });
      setShowAddedMsg(true);
      setTimeout(() => setShowAddedMsg(false), 3000);
    }
  };

  const handleWishlistToggle = async () => {
    if (!user) {
      setLoginVisible(true);
      return;
    }
    if (!product?.id) return;
    
    if (isInWishlist(product.id)) {
      await removeFromWishlist(product.id);
    } else {
      await addToWishlist(product.id);
    }
  };

  const [activeSection, setActiveSection] = useState<string | null>("specs");
  const toggleSection = (id: string) => {
    setActiveSection(activeSection === id ? null : id);
  };
  const navigateToCategory = (cat: string) => {
    setSearchQuery("");
    navigation.navigate('Category', { category: cat });
  };

  const AccordionSection = ({ 
    id, 
    title, 
    children 
  }: { 
    id: string; 
    title: string; 
    children: React.ReactNode 
  }) => {
    const isOpen = activeSection === id;
    return (
      <View style={styles.accordionItem}>
        <TouchableOpacity 
          style={styles.accordionHeader} 
          onPress={() => toggleSection(id)}
          activeOpacity={0.7}
        >
          <Text style={styles.accordionTitle}>{title}</Text>
          <FontAwesome5 
            name={isOpen ? "chevron-up" : "chevron-down"} 
            size={12} 
            color="#D4AF37" 
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.accordionContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  if (fetchingProduct) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>Unveiling Masterpiece...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Masterpiece not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>GO BACK</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showAddedMsg ? (
        <View style={styles.addedMessage}>
          <Text style={styles.addedMessageText}>✨ Added to your bag!</Text>
        </View>
      ) : null}

      <Animated.ScrollView 
        ref={scrollRef} 
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >


        <View style={styles.contentWrapper}>
          <View style={[styles.mainContent, contentStyle]}>
            <View style={[styles.imageColumn, { width: isLargeScreen ? "50%" : "100%" }]}>
              <ProductImageGallery
                allImages={allImages}
                mainImageWidth={mainImageWidth}
                isLargeScreen={isLargeScreen}
                isInWishlist={isInWishlist(product.id)}
                onWishlistToggle={handleWishlistToggle}
              />

              {/* Action Buttons under Image */}
              <View style={[styles.imageActions, { 
                marginLeft: isLargeScreen && allImages.length > 1 ? (thumbnailWidth + thumbnailSpacing) : 0,
                width: isLargeScreen ? undefined : mainImageWidth,
                flex: isLargeScreen ? 1 : undefined,
              }]}>
                {FEATURE_FLAGS.ENABLE_CHECKOUT ? (
                  <>
                    <TouchableOpacity style={styles.actionButton} onPress={handleBuyNow}>
                      <Text style={styles.actionButtonText}>Buy Now</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.addToCartButton]} onPress={handleAddToCart}>
                      <Text style={styles.addToCartButtonText}>Add to Bag</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.whatsappInquiryButton]} 
                    onPress={handleWhatsAppInquiry}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5 name="whatsapp" size={20} color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.whatsappInquiryButtonText}>Inquire on WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[styles.infoSection, { width: isLargeScreen ? "50%" : "100%" }]}>
              <Text style={styles.categoryBadge}>{product.category}</Text>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productCode}>Product Code: {product.productCode}</Text>
              
              {/* Dynamic Price Display */}
              {FEATURE_FLAGS.SHOW_PRICES && (
                <>
                  <View style={styles.priceContainer}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={styles.price}>
                        {formatPrice(dynamicPriceInfo?.total || product.price, countryCode)}
                      </Text>
                      {FEATURE_FLAGS.SHOW_PRICE_BREAKUP && (
                        <TouchableOpacity
                          onPress={() => setIsPriceBreakupVisible(true)}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#382614', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#4a3520' }}
                          activeOpacity={0.8}
                        >
                          <FontAwesome5 name="list-alt" size={12} color="#D4AF37" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: '600' }}>Price Breakup</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Product Configurations section */}
              <View style={styles.configContainer}>
                {!FEATURE_FLAGS.SHOW_ONLY_BASIC_SPECS && (
                  <View style={styles.configSection}>
                    <Text style={styles.configTitle}>Gold Purity</Text>
                    <View style={styles.purityRow}>
                      {['18K', '22K'].map((purity) => (
                        <TouchableOpacity
                          key={purity}
                          style={[styles.purityBadge, selectedPurity === purity && styles.activePurityBadge]}
                          onPress={() => setSelectedPurity(purity)}
                        >
                          <Text style={[styles.purityText, selectedPurity === purity && styles.activePurityText]}>
                            {purity} Gold
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* 2. Size Selector & Interactive Finder */}
                {jewelryType.includes('ring') && (
                  <View style={styles.configSection}>
                    <View style={styles.sizeHeaderRow}>
                      <Text style={styles.configTitle}>Ring Size</Text>
                      <TouchableOpacity onPress={() => setIsSizeFinderVisible(true)}>
                        <Text style={styles.sizeFinderLink}>📐 Find My Size</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.sizeRow}>
                      {[6, 7, 8, 9, 10].map((sz) => (
                        <TouchableOpacity
                          key={sz}
                          style={[styles.sizeBadge, selectedSize === sz && styles.activeSizeBadge]}
                          onPress={() => setSelectedSize(sz)}
                        >
                          <Text style={[styles.sizeText, selectedSize === sz && styles.activeSizeText]}>
                            {sz}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}


              </View>

              <View style={styles.divider} />
              
              <View style={styles.section}>
                {FEATURE_FLAGS.SHOW_ONLY_BASIC_SPECS ? (
                  <AccordionSection id="specs" title="Product Specifications">
                    <View style={styles.specTable}>
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Gross Weight</Text>
                        <Text style={styles.specTableValue}>
                          {product.grossWeight ? `${product.grossWeight.toFixed(3)} g` : '-'}
                        </Text>
                      </View>
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Net Weight</Text>
                        <Text style={styles.specTableValue}>
                          {(product.netWeight || product.goldWeight) ? `${(product.netWeight || product.goldWeight).toFixed(3)} g` : '-'}
                        </Text>
                      </View>
                      {stoneWeightGrams > 0 ? (
                        <View style={styles.specTableRow}>
                          <Text style={styles.specTableLabel}>Stone Weight</Text>
                          <Text style={styles.specTableValue}>{stoneWeightGrams.toFixed(3)} g</Text>
                        </View>
                      ) : null}
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Purity</Text>
                        <Text style={styles.specTableValue}>{product.purity || '22K'}</Text>
                      </View>

                      {/* Small Stone Metadata */}
                      {validStonesInDetail.length > 0 ? (
                        validStonesInDetail.map((st, sIdx) => {
                          const wt = parseFloat(st.weight?.toString() || '0');
                          const valText = (!isNaN(wt) && wt > 0) ? `${wt} ct` : 'Included';
                          return (
                            <View key={st.id || `stone-${sIdx}`} style={styles.specTableRow}>
                              <Text style={styles.specTableLabel}>{st.name || st.category || 'Stone'}</Text>
                              <Text style={styles.specTableValue}>{valText}</Text>
                            </View>
                          );
                        })
                      ) : (
                        <>
                          {product.daiWeight && product.daiWeight > 0 ? (
                            <View style={styles.specTableRow}>
                              <Text style={styles.specTableLabel}>Diamond</Text>
                              <Text style={styles.specTableValue}>
                                {product.daiWeight.toFixed(2)} ct
                              </Text>
                            </View>
                          ) : null}
                          {product.clrStoneWeight && product.clrStoneWeight > 0 ? (
                            <View style={styles.specTableRow}>
                              <Text style={styles.specTableLabel}>Color Stone</Text>
                              <Text style={styles.specTableValue}>
                                {product.clrStoneWeight.toFixed(2)} ct
                              </Text>
                            </View>
                          ) : null}
                          {product.gemstoneType && product.gemstoneType.trim().toLowerCase() !== 'none' && product.gemstoneType.trim() !== '' ? (
                            <View style={styles.specTableRow}>
                              <Text style={styles.specTableLabel}>Gemstone</Text>
                              <Text style={styles.specTableValue}>
                                {product.gemstoneType}{product.gemstoneWeight && product.gemstoneWeight > 0 ? ` • ${product.gemstoneWeight} ct` : ''}
                              </Text>
                            </View>
                          ) : null}
                        </>
                      )}
                    </View>
                  </AccordionSection>
                ) : (
                  <>
                    <AccordionSection id="specs" title="Product Specifications">
                  <View style={styles.specTable}>
                    <View style={styles.specTableRow}>
                      <Text style={styles.specTableLabel}>Product</Text>
                      <Text style={styles.specTableValue}>{product.category}</Text>
                    </View>
                    {product.type ? (
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Type</Text>
                        <Text style={styles.specTableValue}>{product.type}</Text>
                      </View>
                    ) : null}
                    {product.collection ? (
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Collection</Text>
                        <Text style={styles.specTableValue}>{product.collection}</Text>
                      </View>
                    ) : null}
                    {product.gender ? (
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Gender</Text>
                        <Text style={styles.specTableValue}>{product.gender}</Text>
                      </View>
                    ) : null}
                    {product.occasion ? (
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Occasion</Text>
                        <Text style={styles.specTableValue}>{product.occasion}</Text>
                      </View>
                    ) : null}
                    {product.designTheme ? (
                      <View style={styles.specTableRow}>
                        <Text style={styles.specTableLabel}>Design Theme</Text>
                        <Text style={styles.specTableValue}>{product.designTheme}</Text>
                      </View>
                    ) : null}
                  </View>
                </AccordionSection>

                <AccordionSection id="metal" title="Metal Details">
                  <View style={styles.specTable}>
                    <View style={styles.specTableRow}>
                      <Text style={styles.specTableLabel}>Gold Weight</Text>
                      <Text style={styles.specTableValue}>{(product.goldWeight || 0).toFixed(3)} g</Text>
                    </View>
                    <View style={styles.specTableRow}>
                      <Text style={styles.specTableLabel}>Purity</Text>
                      <Text style={styles.specTableValue}>{product.purity}</Text>
                    </View>
                    <View style={styles.specTableRow}>
                      <Text style={styles.specTableLabel}>Metal Color</Text>
                      <Text style={styles.specTableValue}>{product.metalColor}</Text>
                    </View>
                  </View>
                </AccordionSection>

                {(product.stonesInDetail?.length || product.daiWeight || product.clrStoneWeight || product.gemstoneType || product.gemstoneWeight) ? (
                  <AccordionSection id="stone" title="Stone Details">
                    <View style={styles.specTable}>
                      {product.daiWeight ? (
                        <View style={styles.specTableRow}>
                          <Text style={styles.specTableLabel}>Diamond Carat</Text>
                          <Text style={styles.specTableValue}>{product.daiWeight.toFixed(3)} ct</Text>
                        </View>
                      ) : null}
                      {product.clrStoneWeight ? (
                        <View style={styles.specTableRow}>
                          <Text style={styles.specTableLabel}>Color Stone Weight</Text>
                          <Text style={styles.specTableValue}>{product.clrStoneWeight.toFixed(3)} ct</Text>
                        </View>
                      ) : null}
                      {product.gemstoneType && (!product.stonesInDetail || product.stonesInDetail.length === 0) ? (
                        <View style={styles.specTableRow}>
                          <Text style={styles.specTableLabel}>Gemstone Type</Text>
                          <Text style={styles.specTableValue}>{product.gemstoneType}</Text>
                        </View>
                      ) : null}
                    </View>

                    {product.stonesInDetail && product.stonesInDetail.length > 0 && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: 'bold', marginBottom: 8 }}>
                          Detailed Stone Breakdown:
                        </Text>
                        <View style={styles.bhimaInlineTable}>
                          <View style={styles.bhimaTableHeader}>
                            <Text style={[styles.bhimaTh, { flex: 2 }]}>Stone Name</Text>
                            <Text style={[styles.bhimaTh, { flex: 1.5, textAlign: 'right' }]}>Weight</Text>
                            <Text style={[styles.bhimaTh, { flex: 1.5, textAlign: 'right' }]}>Rate (₹)</Text>
                            <Text style={[styles.bhimaTh, { flex: 2, textAlign: 'right' }]}>Total (₹)</Text>
                          </View>
                          {product.stonesInDetail.map((st, sIdx) => {
                            const wt = parseFloat(st.weight?.toString() || st.pcs?.toString() || '0') || 0;
                            const rate = parseFloat(st.rate?.toString() || '0') || 0;
                            const tot = wt * rate;
                            return (
                              <View key={sIdx} style={styles.bhimaTableRow}>
                                <Text style={[styles.bhimaTd, { flex: 2, color: '#fff', fontWeight: '600' }]}>
                                  {st.name}
                                </Text>
                                <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right' }]}>
                                  {wt} ct
                                </Text>
                                <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right', color: '#ccc' }]}>
                                  {rate > 0 ? `₹${rate.toLocaleString('en-IN')}` : '-'}
                                </Text>
                                <Text style={[styles.bhimaTd, { flex: 2, textAlign: 'right', color: '#D4AF37', fontWeight: 'bold' }]}>
                                  {tot > 0 ? `₹${Math.round(tot).toLocaleString('en-IN')}` : '-'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </AccordionSection>
                ) : null}

                </>
                )}

                {FEATURE_FLAGS.SHOW_PRICE_BREAKUP ? (
                <AccordionSection id="price" title="Price Breakup">
                  {/* Metal Details Table */}
                  <View style={styles.bhimaInlineTable}>
                    <View style={styles.bhimaTableHeader}>
                      <Text style={[styles.bhimaTh, { flex: 2 }]}>Component</Text>
                      <Text style={[styles.bhimaTh, { flex: 1.5, textAlign: 'right' }]}>Rate</Text>
                      <Text style={[styles.bhimaTh, { flex: 1.2, textAlign: 'right' }]}>Weight</Text>
                      <Text style={[styles.bhimaTh, { flex: 2, textAlign: 'right' }]}>Value</Text>
                    </View>

                    <View style={styles.bhimaTableRow}>
                      <Text style={[styles.bhimaTd, { flex: 2, color: '#fff', fontWeight: '600' }]}>
                        Gold {selectedPurity}
                      </Text>
                      <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right' }]}>
                        {formatPrice((dynamicPriceInfo?.metalCost || 0) / (product.goldWeight || 1), countryCode)}
                      </Text>
                      <Text style={[styles.bhimaTd, { flex: 1.2, textAlign: 'right' }]}>
                        {(product.goldWeight || 0).toFixed(2)} g
                      </Text>
                      <Text style={[styles.bhimaTd, { flex: 2, textAlign: 'right', color: '#D4AF37', fontWeight: 'bold' }]}>
                        {formatPrice(dynamicPriceInfo?.metalCost || 0, countryCode)}
                      </Text>
                    </View>

                    <View style={styles.bhimaTableRow}>
                      <Text style={[styles.bhimaTd, { flex: 2, color: '#fff', fontWeight: '600' }]}>
                        Making Charges
                      </Text>
                      <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right', color: '#888' }]}>-</Text>
                      <Text style={[styles.bhimaTd, { flex: 1.2, textAlign: 'right', color: '#888' }]}>-</Text>
                      <Text style={[styles.bhimaTd, { flex: 2, textAlign: 'right', color: '#fff', fontWeight: '600' }]}>
                        {formatPrice(dynamicPriceInfo?.vaMaking || 0, countryCode)}
                      </Text>
                    </View>

                    {product.stonesInDetail && product.stonesInDetail.length > 0 ? (
                      product.stonesInDetail.map((st, sIdx) => {
                        const wt = parseFloat(st.weight?.toString() || st.pcs?.toString() || '0') || 0;
                        const rate = parseFloat(st.rate?.toString() || '0') || 0;
                        const totINR = wt * rate;
                        const totUSD = totINR / 83;
                        return (
                          <View key={sIdx} style={styles.bhimaTableRow}>
                            <Text style={[styles.bhimaTd, { flex: 2, color: '#fff', fontWeight: '600' }]}>
                              {st.name}
                            </Text>
                            <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right', color: '#ccc' }]}>
                              {rate > 0 ? (countryCode === 'IN' ? `₹${rate.toLocaleString('en-IN')}` : formatPrice(rate / 83, countryCode)) : '-'}
                            </Text>
                            <Text style={[styles.bhimaTd, { flex: 1.2, textAlign: 'right' }]}>
                              {wt} ct
                            </Text>
                            <Text style={[styles.bhimaTd, { flex: 2, textAlign: 'right', color: '#D4AF37', fontWeight: 'bold' }]}>
                              {formatPrice(totUSD, countryCode)}
                            </Text>
                          </View>
                        );
                      })
                    ) : (dynamicPriceInfo?.stoneBeads || 0) > 0 ? (
                      <View style={styles.bhimaTableRow}>
                        <Text style={[styles.bhimaTd, { flex: 2, color: '#fff', fontWeight: '600' }]}>
                          Gemstones / Stones
                        </Text>
                        <Text style={[styles.bhimaTd, { flex: 1.5, textAlign: 'right', color: '#888' }]}>-</Text>
                        <Text style={[styles.bhimaTd, { flex: 1.2, textAlign: 'right', color: '#888' }]}>
                          {product.gemstoneWeight ? `${(product.gemstoneWeight * 0.2).toFixed(2)} g` : '-'}
                        </Text>
                        <Text style={[styles.bhimaTd, { flex: 2, textAlign: 'right', color: '#fff', fontWeight: '600' }]}>
                          {formatPrice(dynamicPriceInfo?.stoneBeads || 0, countryCode)}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.divider, { marginVertical: 12 }]} />

                  {/* Summary Rows */}
                  <View style={styles.bhimaSummaryBox}>
                    <View style={styles.bhimaSummaryRow}>
                      <Text style={styles.bhimaSummaryLabel}>Subtotal</Text>
                      <Text style={styles.bhimaSummaryValue}>
                        {formatPrice((dynamicPriceInfo?.metalCost || 0) + (dynamicPriceInfo?.vaMaking || 0) + (dynamicPriceInfo?.stoneBeads || 0), countryCode)}
                      </Text>
                    </View>

                    <View style={styles.bhimaSummaryRow}>
                      <Text style={styles.bhimaSummaryLabel}>GST (3%)</Text>
                      <Text style={styles.bhimaSummaryValue}>
                        {formatPrice(dynamicPriceInfo?.tax || 0, countryCode)}
                      </Text>
                    </View>

                    {addGiftWrapping && (
                      <View style={styles.bhimaSummaryRow}>
                        <Text style={styles.bhimaSummaryLabel}>Luxury Packaging</Text>
                        <Text style={styles.bhimaSummaryValue}>{formatPrice(10.00, countryCode)}</Text>
                      </View>
                    )}

                    <View style={styles.bhimaSummaryRow}>
                      <Text style={styles.bhimaSummaryLabel}>Product total</Text>
                      <Text style={styles.bhimaSummaryValue}>
                        {formatPrice(dynamicPriceInfo?.total || product.price, countryCode)}
                      </Text>
                    </View>

                    <View style={[styles.bhimaSummaryRow, styles.bhimaGrandTotalRow]}>
                      <Text style={styles.bhimaGrandTotalLabel}>Grand total</Text>
                      <Text style={styles.bhimaGrandTotalValue}>
                        {formatPrice(dynamicPriceInfo?.total || product.price, countryCode)}
                      </Text>
                    </View>

                    <TouchableOpacity 
                      style={{ marginTop: 14, backgroundColor: '#4a3520', paddingVertical: 10, borderRadius: 6, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }} 
                      onPress={() => setIsPriceBreakupVisible(true)}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5 name="calculator" size={12} color="#D4AF37" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: 'bold' }}>VIEW DETAILED BILL ESTIMATOR MODAL</Text>
                    </TouchableOpacity>
                  </View>
                </AccordionSection>
                ) : null}
              </View>
              {/* Add to Wishlist & Share Registry hidden as requested */}
            </View>
          </View>

          {/* Complete the Suite / Look Section (Inline) */}
          {suiteItems && suiteItems.length > 0 ? (
            <View style={styles.suiteInlineSection}>
              <View style={styles.suiteInlineHeader}>
                <FontAwesome5 name="gem" size={18} color="#D4AF37" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.suiteInlineTitle}>{suiteText.title}</Text>
                  <Text style={styles.suiteInlineSubtitle}>{suiteText.subtitle}</Text>
                </View>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suiteInlineScrollContent}
              >
                {suiteItems.map((item) => (
                  <View key={item.id} style={styles.suiteInlineCard}>
                    <TouchableOpacity onPress={() => onSelectProduct(item)} activeOpacity={0.8}>
                      <OptimizedImage url={item.image} style={styles.suiteInlineImage} shouldLoad={true} />
                    </TouchableOpacity>
                    <View style={styles.suiteInlineCardInfo}>
                      <View>
                        <Text style={styles.suiteInlineItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.suiteInlineItemMeta}>
                          {item.grossWeight ? `${item.grossWeight.toFixed(2)}g` : ''} {item.purity || ''} {item.metalColor || ''}
                        </Text>
                        {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.suiteInlineItemPrice}>{formatPrice(item.price, countryCode)}</Text> : null}
                      </View>
                      
                      <View style={styles.suiteInlineCardActions}>
                        {FEATURE_FLAGS.ENABLE_CART ? (
                          <TouchableOpacity 
                            style={styles.suiteInlineAddBtn}
                            onPress={() => {
                              addToCart(item);
                              setShowAddedMsg(true);
                              setTimeout(() => setShowAddedMsg(false), 3000);
                            }}
                            activeOpacity={0.8}
                          >
                            <FontAwesome5 name="shopping-bag" size={11} color="#291c0e" style={{ marginRight: 6 }} />
                            <Text style={styles.suiteInlineAddBtnText}>Add Matching Piece</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity 
                            style={[styles.suiteInlineAddBtn, { backgroundColor: '#25D366' }]}
                            onPress={() => {
                              const phone = FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER;
                              const msg = `Namaste Moksha Jewels! I am interested in matching piece: *${item.name}* (${item.productCode || item.id}). Please share more details.`;
                              const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                              if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
                              else Linking.openURL(url);
                            }}
                            activeOpacity={0.8}
                          >
                            <FontAwesome5 name="whatsapp" size={12} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={[styles.suiteInlineAddBtnText, { color: '#fff' }]}>Inquire Piece</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                          style={styles.suiteInlineDetailsBtn}
                          onPress={() => onSelectProduct(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.suiteInlineDetailsBtnText}>View Details</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Recommendations Section */}
          {recommendations.length > 0 ? (
            <View style={styles.recommendationsSection}>
              <View style={styles.recHeader}>
                <Text style={styles.recommendationTitle}>Recommended for You</Text>
                <TouchableOpacity onPress={() => navigateToCategory(product.category)}>
                  <Text style={styles.viewMoreHeader}>View All ❯</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recScrollContent}
              >
                {recommendations.slice(0, 15).map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.recommendationCard}
                    onPress={() => onSelectProduct(item)}
                    activeOpacity={0.8}
                  >
                    <OptimizedImage url={item.image} style={styles.recImage} shouldLoad={true} />
                    <View style={styles.recInfo}>
                      <Text style={styles.recName} numberOfLines={1}>{item.name}</Text>
                      {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.recPrice}>{formatPrice(item.price, countryCode)}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}

                {/* View More Card at the end of scroll */}
                <TouchableOpacity 
                  style={[styles.recommendationCard, styles.viewMoreCard]}
                  onPress={() => navigateToCategory(product.category)}
                  activeOpacity={0.8}
                >
                  <View style={styles.viewMoreContent}>
                    <View style={styles.viewMoreIcon}>
                      <FontAwesome5 name="arrow-right" size={16} color="#D4AF37" />
                    </View>
                    <Text style={styles.viewMoreText}>View More</Text>
                    <Text style={styles.viewMoreSub}>In {product.category}</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : null}
        </View>

        <Footer />
      </Animated.ScrollView>

      {/* Interactive Size Finder Modal */}
      <Modal
        visible={isSizeFinderVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsSizeFinderVisible(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.sizeFinderCard}>
            <View style={styles.sizeFinderHeader}>
              <Text style={styles.sizeFinderTitle}>Ring Size Finder</Text>
              <TouchableOpacity onPress={() => setIsSizeFinderVisible(false)}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.sizeFinderContent}>
              <Text style={styles.sizeFinderInstruction}>
                Place a ring you already own directly onto the circle below. Adjust the slider until the outer golden edge matches the inside of your ring perfectly.
              </Text>
              
              <View style={styles.circleContainer}>
                {/* Measuring Circle */}
                <View 
                  style={[
                    styles.measuringCircle, 
                    { 
                      width: sizeFinderDiameter * 6, // scaling factor
                      height: sizeFinderDiameter * 6,
                      borderRadius: (sizeFinderDiameter * 6) / 2
                    }
                  ]} 
                />
                <Text style={styles.diameterText}>{sizeFinderDiameter.toFixed(1)} mm</Text>
              </View>

              {/* Slider steps */}
              <View style={styles.sliderContainer}>
                <Text style={{ color: '#fff', fontSize: 12, marginBottom: 5 }}>Adjust Circle Size:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', marginRight: 10 }}>Min</Text>
                  
                  <TouchableOpacity 
                    style={styles.stepBtn}
                    onPress={() => setSizeFinderDiameter(prev => Math.max(14, prev - 0.2))}
                  >
                    <Text style={styles.stepBtnText}>-</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.sliderBar}>
                    <View style={[styles.sliderFill, { width: `${((sizeFinderDiameter - 14) / 8) * 100}%` }]} />
                  </View>

                  <TouchableOpacity 
                    style={styles.stepBtn}
                    onPress={() => setSizeFinderDiameter(prev => Math.min(22, prev + 0.2))}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                  
                  <Text style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>Max</Text>
                </View>
              </View>

              {/* Estimated Size Output */}
              <View style={styles.sizeFinderResult}>
                <Text style={styles.resultLabel}>Estimated Ring Size:</Text>
                <Text style={styles.resultValue}>
                  {sizeFinderDiameter < 15.0 ? "Size 4" :
                   sizeFinderDiameter < 15.7 ? "Size 5" :
                   sizeFinderDiameter < 16.5 ? "Size 6" :
                   sizeFinderDiameter < 17.3 ? "Size 7" :
                   sizeFinderDiameter < 18.2 ? "Size 8" :
                   sizeFinderDiameter < 19.0 ? "Size 9" :
                   sizeFinderDiameter < 19.8 ? "Size 10" :
                   sizeFinderDiameter < 20.6 ? "Size 11" :
                   "Size 12"}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.selectSizeBtn} 
                onPress={() => {
                  let est = 7;
                  if (sizeFinderDiameter < 15.0) est = 4;
                  else if (sizeFinderDiameter < 15.7) est = 5;
                  else if (sizeFinderDiameter < 16.5) est = 6;
                  else if (sizeFinderDiameter < 17.3) est = 7;
                  else if (sizeFinderDiameter < 18.2) est = 8;
                  else if (sizeFinderDiameter < 19.0) est = 9;
                  else if (sizeFinderDiameter < 19.8) est = 10;
                  else if (sizeFinderDiameter < 20.6) est = 11;
                  else est = 12;
                  setSelectedSize(est);
                  setIsSizeFinderVisible(false);
                }}
              >
                <Text style={styles.selectSizeBtnText}>Select This Size</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Store Availability Check Modal */}
      {product && (
        <StoreAvailabilityModal
          visible={isStoreCheckVisible}
          onClose={() => setIsStoreCheckVisible(false)}
          product={product}
          countryCode={countryCode}
          matchingProducts={suiteItems}
          onSelectProduct={onSelectProduct}
        />
      )}

      {/* Detailed Price Breakup & Bill Estimator Modal */}
      {product && (
        <PriceBreakupModal
          visible={isPriceBreakupVisible}
          onClose={() => setIsPriceBreakupVisible(false)}
          product={product}
          selectedPurity={selectedPurity}
          addGiftWrapping={addGiftWrapping}
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#291c0e",
  },
  scrollContent: {
    flexGrow: 1,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    borderRadius: 4,
    marginTop: 20,
  },
  backBtnText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#291c0e",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#D4AF37",
    fontFamily: "TrajanPro",
    fontSize: 16,
    letterSpacing: 1,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
  },
  contentWrapper: {
    flex: 1,
  },
  addedMessage: {
    backgroundColor: "#D4AF37",
    paddingVertical: 10,
    alignItems: "center",
    position: "absolute",
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  addedMessageText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 14,
  },
  mainContent: {
    padding: 20,
    gap: 30,
  },
  imageColumn: {
    gap: 20,
    position: "relative", // Crucial for absolute positioning of the zoom overlay
    zIndex: 10,
  },
  thumbnailColumn: {
    width: 64,
    marginRight: 12,
    alignItems: 'center',
  },
  thumbnailScrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  thumbnailCard: {
    width: 64,
    height: 64,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    overflow: 'hidden',
    backgroundColor: '#201409',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }
    })
  },
  activeThumbnailCard: {
    borderColor: '#D4AF37',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  imageSection: {
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#1a120b",
    borderWidth: 1,
    borderColor: "#4a3520",
    position: "relative",
  },
  imageWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    backgroundColor: '#D4AF37',
    width: 12, // Slightly wider for active
  },
  imageActions: {
    marginTop: 20,
    gap: 10,
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  wishlistIcon: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  heart: {
    color: "#fff",
    fontSize: 24,
  },
  heartActive: {
    color: "#D4AF37",
  },
  zoomOverlay: {
    position: "absolute",
    top: 0,
    backgroundColor: "#1a120b",
    borderWidth: 2,
    borderColor: "#D4AF37",
    borderRadius: 8,
    zIndex: 1000,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
    // @ts-ignore
    pointerEvents: "none", // Prevent overlay from intercepting mouse events
  },
  zoomedImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1a120b", // Match the dark background
    // @ts-ignore
    backgroundRepeat: 'no-repeat',
    // @ts-ignore
    backgroundSize: '400%', // Increased zoom level for better detail
  },
  infoSection: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  categoryBadge: {
    color: "#D4AF37",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  productName: {
    fontFamily: "TrajanPro",
    fontSize: 28,
    color: "#fff",
    marginBottom: 5,
  },
  productCode: {
    color: "#888",
    fontSize: 12,
    marginBottom: 15,
    letterSpacing: 1,
  },
  price: {
    fontSize: 24,
    color: "#D4AF37",
    fontWeight: "bold",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#4a3520",
    marginVertical: 20,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: "TrajanPro",
    color: "#fff",
    fontSize: 16,
    marginBottom: 15,
    letterSpacing: 1,
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  specLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  specValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  specTable: {
    borderWidth: 1,
    borderColor: "#4a3520",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 10,
  },
  specTableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#4a3520",
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  specTableLabel: {
    flex: 1,
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  specTableValue: {
    flex: 1.5,
    color: "#fff",
    fontSize: 13,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  priceLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  priceValue: {
    color: "#fff",
    fontSize: 14,
  },
  totalRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#4a3520",
  },
  totalLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  totalValue: {
    color: "#D4AF37",
    fontSize: 18,
    fontWeight: "bold",
  },
  whatsappInquiryButton: {
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  whatsappInquiryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  actionButton: {
    backgroundColor: "#D4AF37",
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 15,
  },
  actionButtonText: {
    color: "#291c0e",
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  arButton: {
    backgroundColor: "#D4AF37",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  arButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  addToCartButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D4AF37",
  },
  addToCartButtonText: {
    color: "#D4AF37",
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  storeCheckButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D4AF37",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  storeCheckButtonText: {
    color: "#D4AF37",
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#4a3520",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 14,
  },
  recommendationsSection: {
    padding: 20,
    marginTop: 20,
  },
  recommendationTitle: {
    fontFamily: "TrajanPro",
    fontSize: 20,
    color: "#fff",
    marginBottom: 20,
    letterSpacing: 1,
  },
  recommendationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 10,
  },
  recommendationCard: {
    width: 160,
    height: 220,
    backgroundColor: "#150d05",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 8,
    overflow: "hidden",
  },
  recImage: {
    width: "100%",
    height: 150,
  },
  recInfo: {
    padding: 10,
    height: 68,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  recName: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
  },
  recPrice: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
  },
  // Recommendation Carousel Styles
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  viewMoreHeader: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recScrollContent: {
    paddingRight: 20,
    paddingVertical: 10,
    gap: 15,
  },
  viewMoreCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewMoreContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  viewMoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewMoreText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewMoreSub: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  // Accordion Styles
  accordionItem: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.15)",
    marginBottom: 5,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
  },
  accordionTitle: {
    fontFamily: "TrajanPro",
    color: "#fff",
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  accordionContent: {
    paddingBottom: 15,
  },
  // Review Styles
  reviewsSection: {
    padding: 20,
    marginTop: 10,
  },
  reviewForm: {
    backgroundColor: "rgba(212, 175, 55, 0.05)",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    marginBottom: 30,
  },
  formLabel: {
    color: "#D4AF37",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 15,
  },
  ratingRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  reviewInput: {
    backgroundColor: "#3d2b1a",
    color: "#fff",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4a3520",
    height: 100,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  submitBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#000",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  reviewsList: {
    gap: 20,
  },
  reviewCard: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.1)",
    paddingBottom: 20,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  reviewerName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewComment: {
    color: "#aaa",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  reviewDate: {
    color: "#666",
    fontSize: 10,
  },
  emptyReviews: {
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },

  priceContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 5,
    backgroundColor: "rgba(212,175,55,0.05)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
  },
  priceAlertBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D4AF37",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  priceAlertBtnActive: {
    backgroundColor: "#D4AF37",
  },
  priceAlertText: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  priceAlertActiveText: {
    color: "#291c0e",
  },
  splitPaymentContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  splitPaymentText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
  },
  splitPaymentHighlight: {
    color: "#D4AF37",
    fontWeight: "bold",
  },
  configContainer: {
    gap: 15,
  },
  configSection: {
    gap: 8,
  },
  configTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  purityRow: {
    flexDirection: "row",
    gap: 10,
  },
  purityBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  activePurityBadge: {
    borderColor: "#D4AF37",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
  },
  purityText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "bold",
  },
  activePurityText: {
    color: "#D4AF37",
  },
  sizeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sizeFinderLink: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  sizeRow: {
    flexDirection: "row",
    gap: 8,
  },
  sizeBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  activeSizeBadge: {
    borderColor: "#D4AF37",
    backgroundColor: "#D4AF37",
  },
  sizeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  activeSizeText: {
    color: "#291c0e",
  },
  engravingInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 13,
  },
  engravingPreview: {
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 10,
    borderRadius: 6,
    marginTop: 5,
    alignItems: "center",
  },
  engravingPreviewLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginBottom: 6,
  },
  ringPreviewBand: {
    borderWidth: 3,
    borderColor: "#D4AF37",
    borderStyle: "solid",
    paddingVertical: 6,
    paddingHorizontal: 30,
    borderRadius: 20,
    backgroundColor: "rgba(212,175,55,0.05)",
    shadowColor: "#D4AF37",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    alignItems: "center",
  },
  ringPreviewText: {
    color: "#D4AF37",
    fontStyle: "italic",
    fontSize: 13,
    letterSpacing: 1.5,
    textShadowColor: "rgba(212, 175, 55, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  priceChartContainer: {
    marginTop: 5,
    gap: 10,
  },
  chartStack: {
    height: 10,
    flexDirection: "row",
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  chartBar: {
    height: "100%",
  },
  chartLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  giftCard: {
    marginTop: 15,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.2)",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(212,175,55,0.02)",
  },
  giftCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    backgroundColor: "rgba(212,175,55,0.04)",
  },
  giftCardTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  giftCardContent: {
    padding: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(212,175,55,0.1)",
  },
  giftCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  customCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  customCheckboxChecked: {
    backgroundColor: "#D4AF37",
  },
  giftCheckboxText: {
    color: "#fff",
    fontSize: 12,
  },
  giftMsgLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 4,
  },
  giftMsgInput: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    color: "#fff",
    padding: 8,
    fontSize: 12,
    height: 50,
    textAlignVertical: "top",
  },
  engagementRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  engagementBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D4AF37",
    paddingVertical: 12,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  engagementBtnText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
  },
  whatsappConsultBtn: {
    borderColor: "#25D366",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sizeFinderCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#291c0e",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    borderRadius: 12,
    overflow: "hidden",
  },
  sizeFinderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.15)",
    backgroundColor: "rgba(212,175,55,0.04)",
  },
  sizeFinderTitle: {
    color: "#D4AF37",
    fontSize: 16,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sizeFinderContent: {
    padding: 20,
    alignItems: "center",
    gap: 15,
  },
  sizeFinderInstruction: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  circleContainer: {
    width: 200,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  measuringCircle: {
    borderWidth: 3,
    borderColor: "#D4AF37",
    backgroundColor: "transparent",
  },
  diameterText: {
    color: "#D4AF37",
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 10,
  },
  sliderContainer: {
    width: "100%",
    marginTop: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212,175,55,0.2)",
    borderWidth: 1,
    borderColor: "#D4AF37",
    justifyContent: "center",
    alignItems: "center",
  },
  stepBtnText: {
    color: "#D4AF37",
    fontSize: 18,
    fontWeight: "bold",
  },
  sliderBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: "hidden",
  },
  sliderFill: {
    height: "100%",
    backgroundColor: "#D4AF37",
  },
  sizeFinderResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(212,175,55,0.05)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.15)",
    width: "100%",
    justifyContent: "center",
  },
  resultLabel: {
    color: "#fff",
    fontSize: 13,
  },
  resultValue: {
    color: "#D4AF37",
    fontSize: 16,
    fontWeight: "bold",
  },
  selectSizeBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
    marginTop: 10,
  },
  selectSizeBtnText: {
    color: "#291c0e",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Suite / Complete the look styles
  suiteSection: {
    marginTop: 20,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(212, 175, 55, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.15)",
  },
  suiteTitle: {
    fontFamily: "TrajanPro",
    fontSize: 16,
    color: "#D4AF37",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  suiteSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginBottom: 20,
  },
  suiteContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  suiteCard: {
    flex: 1,
    minWidth: 260,
    backgroundColor: "#150d05",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 8,
    padding: 12,
    justifyContent: "space-between",
  },
  suiteCardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  suiteImage: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: "#201409",
  },
  suiteCardInfo: {
    flex: 1,
    gap: 4,
  },
  suiteCardName: {
    fontFamily: "TrajanPro",
    color: "#fff",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  suiteCardMeta: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
  },
  suiteCardPrice: {
    color: "#D4AF37",
    fontSize: 13,
    fontWeight: "bold",
  },
  suiteAddBtn: {
    borderWidth: 1,
    borderColor: "#D4AF37",
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  suiteAddBtnText: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addAllSuiteBtn: {
    backgroundColor: "#D4AF37",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addAllSuiteBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  blurModalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  bottomRightPopupWrapper: {
    padding: Platform.OS === 'web' ? 30 : 20,
    width: "100%",
    maxWidth: 400,
    alignSelf: Platform.OS === 'web' ? 'flex-end' : 'center',
    zIndex: 10001,
  },
  bottomRightPopupCard: {
    backgroundColor: '#1d130a',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 12,
    width: "100%",
  },
  bottomRightPopupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212,175,55,0.15)",
    paddingBottom: 10,
    marginBottom: 15,
  },
  bottomRightPopupTitle: {
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
    color: "#D4AF37",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: "bold",
  },
  bottomRightPopupBody: {
    gap: 15,
    alignItems: "center",
  },
  bottomRightPopupImage: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: "#201409",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
  },
  bottomRightPopupInfo: {
    alignItems: "center",
    gap: 4,
    width: "100%",
  },
  bottomRightPopupName: {
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },
  bottomRightPopupMeta: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    textAlign: "center",
  },
  bottomRightPopupPrice: {
    color: "#D4AF37",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 2,
  },
  bottomRightPopupActions: {
    width: "100%",
    gap: 8,
    marginTop: 5,
  },
  bottomRightPopupAddBtn: {
    backgroundColor: "#D4AF37",
    borderRadius: 20,
    paddingVertical: 10,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomRightPopupAddBtnText: {
    color: "#291c0e",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bottomRightPopupDetailsBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.5)",
    borderRadius: 20,
    paddingVertical: 10,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomRightPopupDetailsBtnText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bottomPopupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomPopupCloseBtn: {
    padding: 2,
  },
  bhimaInlineTable: {
    backgroundColor: '#382614',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a3520',
    overflow: 'hidden',
    marginTop: 5,
  },
  bhimaTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4a3520',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#5c432a',
  },
  bhimaTh: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bhimaTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  bhimaTd: {
    color: '#ddd',
    fontSize: 13,
  },
  bhimaSummaryBox: {
    backgroundColor: '#382614',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#4a3520',
  },
  bhimaSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  bhimaSummaryLabel: {
    color: '#aaa',
    fontSize: 13,
  },
  bhimaSummaryValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bhimaGrandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#D4AF37',
    marginTop: 8,
    paddingTop: 10,
  },
  bhimaGrandTotalLabel: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bhimaGrandTotalValue: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: 'bold',
  },
  suiteInlineSection: {
    marginTop: 25,
    marginBottom: 20,
    backgroundColor: '#382614',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#4a3520',
  },
  suiteInlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  suiteInlineTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#D4AF37',
    fontFamily: Platform.OS === 'ios' ? 'TrajanPro' : 'serif',
  },
  suiteInlineSubtitle: {
    fontSize: 13,
    color: '#aaa',
    marginTop: 2,
  },
  suiteInlineScrollContent: {
    paddingVertical: 4,
    gap: 16,
  },
  suiteInlineCard: {
    width: 250,
    backgroundColor: '#291c0e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4a3520',
    overflow: 'hidden',
    flexDirection: 'column',
    marginRight: 14,
  },
  suiteInlineImage: {
    width: '100%',
    height: 170,
    backgroundColor: '#20160b',
  },
  suiteInlineCardInfo: {
    padding: 14,
    flex: 1,
    justifyContent: 'space-between',
  },
  suiteInlineItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  suiteInlineItemMeta: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  suiteInlineItemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#D4AF37',
    marginBottom: 12,
  },
  suiteInlineCardActions: {
    gap: 8,
  },
  suiteInlineAddBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suiteInlineAddBtnText: {
    color: '#291c0e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suiteInlineDetailsBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4a3520',
    alignItems: 'center',
    marginTop: 6,
  },
  suiteInlineDetailsBtnText: {
    color: '#D4AF37',
    fontSize: 12,
  },
});

export default ProductDetailsScreen;
