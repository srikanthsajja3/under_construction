import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, useWindowDimensions, Platform, TextInput, ScrollView, Animated, Alert } from "react-native";
import { useCountry } from "../contexts/CountryContext";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import GoldRateBanner from "./GoldRateBanner";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome5 } from '@expo/vector-icons';

import { useNavigation, useRoute, NavigationProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/types";

import { useUI } from "../contexts/UIContext";
import { FEATURE_FLAGS } from "../config/features";
import { Linking } from "react-native";

const MAX_CONTENT_WIDTH = Platform.OS === 'web' ? '98%' : 1200;
const MAX_PX_WIDTH = 2500;

const HoverNavBadge = ({ label, isActive, onPress }: { label: string; isActive: boolean; onPress: () => void }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[
        styles.navBadge,
        isActive && styles.activeNavBadge,
        hovered && !isActive && styles.hoverNavBadge
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      // @ts-ignore
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore
      onMouseLeave={() => setHovered(false)}
    >
      <Text style={[
        styles.navBadgeText,
        isActive && styles.activeNavBadgeText,
        hovered && !isActive && styles.hoverNavBadgeText
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

interface HeaderProps {
  scrollY?: Animated.Value;
  searchQuery: string;
  onSearch: (query: string) => void;
  isHome?: boolean;
  onPressMenu?: () => void;
  activeCategory?: string;
}



const Header: React.FC<HeaderProps> = ({ 
  scrollY,
  searchQuery,
  onSearch,
  isHome: isHomeProp,
  onPressMenu,
  activeCategory = ""
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, isAdmin, isVendor } = useAuth();
  const { cartCount } = useCart();
  const { countryCode } = useCountry();
  const { setLoginVisible, setSearchQuery } = useUI();
  const [searchVisible, setSearchVisible] = useState(false);
  const searchAnim = React.useRef(new Animated.Value(0)).current;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isHome = !!isHomeProp;
  
  const isWeb = Platform.OS === "web";
  const isIOS = Platform.OS === "ios";
  const isMobile = width < 1024; // Align with CategoryBar's width breakpoint for desktop tabs


  const navigateToHome = () => {
    setSearchQuery("");
    navigation.navigate('Home');
  };
  const navigateToLogin = () => setLoginVisible(true);
  const navigateToCart = () => navigation.navigate('Cart');
  
  const navigateToOrders = () => {
    if (user) navigation.navigate('Orders');
    else setLoginVisible(true);
  };
  
  const navigateToWishlist = () => {
    if (user) navigation.navigate('Wishlist');
    else setLoginVisible(true);
  };
  
  const navigateToProfile = () => {
    if (user) navigation.navigate('Profile');
    else setLoginVisible(true);
  };
  
  const navigateToAdmin = () => isAdmin ? navigation.navigate('AdminDashboard') : null;
  const navigateToVendor = () => isVendor ? navigation.navigate('VendorDashboard') : null;

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  const toggleSearch = useCallback(() => {
    setSearchVisible(prev => {
      const nextVal = !prev;
      Animated.spring(searchAnim, {
        toValue: nextVal ? 1 : 0,
        useNativeDriver: false,
        friction: 8,
        tension: 40
      }).start();
      return nextVal;
    });
  }, [searchAnim]);

  useEffect(() => {
    if (scrollY) {
      const listenerId = scrollY.addListener(({ value }) => {
        if (value > 50) {
          setSearchVisible(currentVisible => {
            if (currentVisible) {
              Animated.spring(searchAnim, {
                toValue: 0,
                useNativeDriver: false,
                friction: 8,
                tension: 40
              }).start();
              return false;
            }
            return currentVisible;
          });
        }
      });
      return () => {
        scrollY.removeListener(listenerId);
      };
    }
  }, [scrollY, searchAnim]);

  const searchHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  const searchOpacity = searchAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  
  // Base values
  const baseLogoSize = width > 768 ? 60 : (isIOS ? 45 : 38);
  const baseTitleSize = width > 768 ? 24 : (width < 380 ? 15 : 17);
  const letterSpacing = width > 768 ? 1.5 : 1;
  const iconSize = width > 768 ? 20 : 18;
  const navIconSize = width > 768 ? 16 : 14;
  
  const paddingHorz = isWeb 
    ? (width > 1400 ? 30 : 15)
    : (width < 380 ? 8 : 12);

  const iconMargin = width > 768 ? 12 : (width < 380 ? 6 : 8);

  // Animations & Static Sizes
  const scrollOffset = scrollY || new Animated.Value(0);

  // Logo Scale: Consistent 0.75 scale across all pages for brand consistency
  const logoScale = 0.75;

  // Header Height: Unified height across all pages for a consistent navigation experience
  const baseHeaderHeight = isMobile ? 75 : 60;
  
  const headerHeight = isWeb ? baseHeaderHeight : (baseHeaderHeight + insets.top);

  const headerPadding = scrollOffset.interpolate({
    inputRange: [0, 100],
    outputRange: [isWeb ? 8 : 12, 4],
    extrapolate: 'clamp',
  });

  const bannerOpacity = scrollOffset.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const bannerHeight = scrollOffset.interpolate({
    inputRange: [0, 50],
    outputRange: [45, 0],
    extrapolate: 'clamp',
  });



  return (
    <Animated.View style={styles.container}>
      <Animated.View style={[
        styles.header, 
        { 
          paddingHorizontal: paddingHorz,
          paddingTop: isWeb ? headerPadding : Math.max(insets.top, 5),
          paddingBottom: headerPadding,
          minHeight: headerHeight,
        }
      ]}>
        <View 
          style={styles.centerWrapper}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
            {!isHome && !isMobile && (
              <TouchableOpacity 
                style={[styles.actionItem, { marginRight: 8 }]} 
                onPress={handleGoBack}
              >
                <FontAwesome5 name="chevron-left" size={iconSize} color="#D4AF37" />
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.brandContainer}
              onPress={navigateToHome}
              activeOpacity={0.7}
            >
              <Animated.View style={{ 
                flexDirection: 'row',
                alignItems: 'center',
                // @ts-ignore - transformOrigin is supported in modern RN (0.73+) and Web
                transformOrigin: 'left center',
                transform: [
                  { scale: logoScale },
                ]
              }}>
                <Image
                  source={require("../../assets/logo.jpg")}
                  style={[styles.logo, { width: baseLogoSize, height: baseLogoSize, borderRadius: 8 }]}
                />
                <Text 
                  numberOfLines={1} 
                  adjustsFontSizeToFit 
                  style={[styles.title, { fontSize: baseTitleSize, letterSpacing: letterSpacing }]}
                >
                  MOKSHA JEWELS
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {!isMobile && (
            <View style={styles.centerNav}>
              {["All", "Gold", "Diamonds", "Polki", "Kundan"].map((cat) => (
                <HoverNavBadge
                  key={cat}
                  label={cat}
                  isActive={activeCategory === cat}
                  onPress={() => {
                    setSearchQuery("");
                    navigation.navigate('Category', { category: cat, subCategory: 'All Items' });
                  }}
                />
              ))}
            </View>
          )}

          <View style={styles.actionsRightGroup}>
            <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={toggleSearch}>
              <FontAwesome5 name="search" size={iconSize} color={searchVisible ? "#fff" : "#D4AF37"} />
            </TouchableOpacity>

            {isMobile ? (
              <>
                <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToWishlist}>
                  <FontAwesome5 name="heart" size={iconSize} color="#D4AF37" />
                </TouchableOpacity>

                {FEATURE_FLAGS.ENABLE_CART ? (
                  <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToCart}>
                    <View>
                      <FontAwesome5 name="shopping-bag" size={iconSize} color="#D4AF37" />
                      {cartCount > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{cartCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionItem, { marginLeft: iconMargin }]} 
                    onPress={() => {
                      const url = `https://wa.me/${FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent("Namaste Moksha Jewels! I would like to inquire about your jewelry collection.")}`;
                      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
                      else Linking.openURL(url);
                    }}
                    accessibilityLabel="WhatsApp Inquiry"
                  >
                    <FontAwesome5 name="whatsapp" size={iconSize + 2} color="#25D366" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={onPressMenu}>
                  <FontAwesome5 name="bars" size={iconSize} color="#D4AF37" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToWishlist}>
                  <FontAwesome5 name="heart" size={iconSize} color="#D4AF37" />
                </TouchableOpacity>

                {user && FEATURE_FLAGS.ENABLE_ORDERS ? (
                  <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToOrders}>
                    <FontAwesome5 name="history" size={iconSize} color="#D4AF37" />
                  </TouchableOpacity>
                ) : null}

                {FEATURE_FLAGS.ENABLE_CART ? (
                  <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToCart}>
                    <View>
                      <FontAwesome5 name="shopping-bag" size={iconSize} color="#D4AF37" />
                      {cartCount > 0 ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{cartCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionItem, { marginLeft: iconMargin }]} 
                    onPress={() => {
                      const url = `https://wa.me/${FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent("Namaste Moksha Jewels! I would like to inquire about your jewelry collection.")}`;
                      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
                      else Linking.openURL(url);
                    }}
                    accessibilityLabel="WhatsApp Inquiry"
                  >
                    <FontAwesome5 name="whatsapp" size={iconSize + 2} color="#25D366" />
                  </TouchableOpacity>
                )}

                {isAdmin ? (
                  <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToAdmin}>
                    <Text style={styles.adminBadge}>ADMIN</Text>
                  </TouchableOpacity>
                ) : null}

                {isVendor ? (
                  <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToVendor}>
                    <Text style={styles.vendorBadge}>PARTNER</Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.authGroup}>
                  {user ? (
                    <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToProfile}>
                      <FontAwesome5 name="user-circle" size={iconSize} color="#D4AF37" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.actionItem, { marginLeft: iconMargin }]} onPress={navigateToLogin}>
                      <FontAwesome5 name="sign-in-alt" size={iconSize} color="#D4AF37" />
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: searchOpacity, height: searchHeight, overflow: 'hidden', backgroundColor: '#1a1008', borderBottomWidth: searchVisible ? 1 : 0, borderBottomColor: '#D4AF37' }}>
        <View style={[styles.centerWrapper, { height: '100%', paddingHorizontal: paddingHorz }]}>
          <View style={styles.searchBarContainer}>
            <FontAwesome5 name="search" size={14} color="#888" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by SKU, code (e.g. DPNT6), name, or gemstone..."
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={(txt) => {
                onSearch(txt);
              }}
              onSubmitEditing={() => {
                if (searchQuery.trim().length > 0) {
                  navigation.navigate('Category', { category: 'All' });
                }
              }}
              returnKeyType="search"
              autoFocus={searchVisible}
              clearButtonMode="while-editing"
              multiline={false}
              accessibilityLabel="Search masterpieces"
              aria-label="Search masterpieces"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearch("")} style={{ padding: 4, marginRight: 6 }}>
                <FontAwesome5 name="times-circle" size={16} color="#D4AF37" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={toggleSearch} style={{ padding: 4 }}>
              <FontAwesome5 name="times" size={16} color="#D4AF37" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {isHome && FEATURE_FLAGS.SHOW_GOLD_RATES && (
        <Animated.View style={{ opacity: bannerOpacity, height: bannerHeight, overflow: 'hidden' }}>
          <GoldRateBanner />
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#291c0e",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(212, 175, 55, 0.15)",
    zIndex: 100,
  },
  header: {
    paddingBottom: 15,
    overflow: 'visible', // Adjusted from 'hidden' to render overlays without clipping
    justifyContent: 'center',
  },
  centerWrapper: {
    maxWidth: MAX_PX_WIDTH,
    width: MAX_CONTENT_WIDTH,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative", // Needed for absolute positioning of child overlays
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginVertical: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
    height: '100%',
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  logo: {
    marginRight: 12,
  },
  title: {
    fontFamily: "TrajanPro",
    color: "#D4AF37",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  actionsRightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionItem: {
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
  },
  dotBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    borderWidth: 1.5,
    borderColor: '#291c0e',
  },
  adminBadge: {
    color: '#fff', 
    backgroundColor: '#D4AF37', 
    paddingHorizontal: 8, 
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden'
  },
  vendorBadge: {
    color: '#D4AF37', 
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 8, 
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
  },
  authGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  centerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    flexGrow: 1,
    flexShrink: 1,
    paddingHorizontal: 20,
  },
  navBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }
    }) as any,
  },
  activeNavBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  hoverNavBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  navBadgeText: {
    color: 'rgba(212, 175, 55, 0.6)',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'web' ? 'Trajan Pro' : 'TrajanPro',
    ...Platform.select({
      web: {
        transition: 'color 0.2s ease',
      }
    }) as any,
  },
  activeNavBadgeText: {
    color: '#D4AF37',
  },
  hoverNavBadgeText: {
    color: '#D4AF37',
  },
});

export default Header;
