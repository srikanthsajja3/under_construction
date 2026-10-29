import React, { useEffect, useRef, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  TouchableWithoutFeedback,
  Platform,
  ScrollView,
  Pressable,
  Alert
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { FEATURE_FLAGS } from '../config/features';
import { Linking } from 'react-native';

interface SideDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  activeScreen: string;
}

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.6 > 260 ? 260 : width * 0.6;

const SideDrawer: React.FC<SideDrawerProps> = ({ isVisible, onClose, onNavigate, activeScreen }) => {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { user, isAdmin, isVendor, signOut } = useAuth();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [isVisible]);

  const handleNavigate = (screen: string) => {
    onNavigate(screen as any);
    onClose();
  };

  const toggleCategory = (catName: string) => {
    setExpandedCategory(expandedCategory === catName ? null : catName);
  };

  const handleCategoryPress = (category: string, subCategory?: string) => {
    onClose();
    navigation.navigate('Category', { category, subCategory });
  };

  const NavItem = ({ icon, label, screen, badge }: { icon: string, label: string, screen: string, badge?: string }) => {
    const isActive = activeScreen === screen;
    return (
      <TouchableOpacity 
        style={[styles.navItem, isActive && styles.activeNavItem]} 
        onPress={() => handleNavigate(screen)}
      >
        <View style={styles.navIconContainer}>
          <FontAwesome5 name={icon} size={18} color={isActive ? "#D4AF37" : "#aaa"} />
        </View>
        <Text style={[styles.navLabel, isActive && styles.activeNavLabel]}>{label}</Text>
        {badge ? (
          <View style={[styles.badge, badge === 'ADMIN' ? styles.adminBadge : styles.vendorBadge]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const DrawerCategoryItem = ({ label, icon, subItems, categoryName }: { label: string; icon: string; subItems?: string[]; categoryName: string }) => {
    const isExpanded = expandedCategory === label;
    const hasSubitems = subItems && subItems.length > 0;
    
    return (
      <View style={styles.categoryItemContainer}>
        <TouchableOpacity 
          style={styles.categoryHeader} 
          onPress={() => {
            if (hasSubitems) {
              toggleCategory(label);
            } else {
              handleCategoryPress(categoryName);
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.categoryHeaderLeft}>
            <FontAwesome5 name={icon} size={15} color="#D4AF37" style={styles.categoryHeaderIcon} />
            <Text style={styles.categoryLabel}>{label}</Text>
          </View>
          {hasSubitems ? (
            <FontAwesome5 name={isExpanded ? "chevron-up" : "chevron-down"} size={12} color="#aaa" />
          ) : null}
        </TouchableOpacity>
        
        {hasSubitems && isExpanded && (
          <View style={styles.categorySubList}>
            {subItems.map((sub, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.categorySubItem}
                onPress={() => handleCategoryPress(categoryName, sub)}
                activeOpacity={0.7}
              >
                <Text style={styles.categorySubItemText}>{sub}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (!isVisible && (slideAnim as any)._value === -DRAWER_WIDTH) return null;

  return (
    <View 
      style={[
        StyleSheet.absoluteFill, 
        { 
          zIndex: 10000,
          pointerEvents: isVisible ? "auto" : "none"
        }
      ]}
    >
      {/* Backdrop */}
      <Pressable 
        style={StyleSheet.absoluteFill} 
        onPress={onClose}
      >
        <Animated.View style={[styles.backdrop, { opacity: opacityAnim, zIndex: 10000 }]} />
      </Pressable>

      {/* Drawer Content */}
      <Animated.View style={[
        styles.drawer, 
        { 
          transform: [{ translateX: slideAnim }],
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          zIndex: 10001
        }
      ]}>
        <View style={styles.drawerHeader}>
          <Text style={styles.drawerTitle}>MOKSHA JEWELS</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={20} color="#D4AF37" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.navScroll}>
          <NavItem icon="home" label="Home" screen="home" />
          <NavItem icon="heart" label="Wishlist" screen="wishlist" />
          
          {user ? (
            <>
              {FEATURE_FLAGS.ENABLE_ORDERS ? (
                <NavItem icon="history" label="My Orders" screen="orders" />
              ) : null}
              <NavItem icon="user-circle" label="Profile" screen="profile" />
            </>
          ) : null}

          {FEATURE_FLAGS.ENABLE_WHATSAPP_INQUIRY ? (
            <TouchableOpacity 
              style={styles.navItem} 
              onPress={() => {
                onClose();
                const url = `https://wa.me/${FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER}?text=${encodeURIComponent("Namaste Moksha Jewels! I would like to inquire about your jewelry collection.")}`;
                if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
                else Linking.openURL(url);
              }}
            >
              <View style={styles.navIconContainer}>
                <FontAwesome5 name="whatsapp" size={18} color="#25D366" />
              </View>
              <Text style={[styles.navLabel, { color: "#25D366" }]}>WhatsApp Us</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.separator} />

          <View style={styles.drawerSectionHeader}>
            <Text style={styles.drawerSectionTitle}>Shop Categories</Text>
          </View>

          <DrawerCategoryItem 
            label="Gold" 
            icon="coins" 
            categoryName="Gold" 
            subItems={["Bangles", "HARAMS", "RINGS", "NECKLACE", "Earrings", "PENDANTS"]} 
          />
          <DrawerCategoryItem 
            label="Diamonds" 
            icon="gem" 
            categoryName="Diamonds" 
            subItems={["Bangles", "Earrings", "Rings", "NECKLACE", "PENDANTS"]} 
          />

          






          <DrawerCategoryItem 
            label="New Arrivals" 
            icon="star" 
            categoryName="All" 
            subItems={["BUTTERFLY", "GLAM & GLITZ", "SILVIGO", "FLORAL", "V Kids", "TRINITY"]} 
          />

          <View style={styles.separator} />

          {isAdmin || isVendor ? (
            <NavItem icon="user-shield" label="Host Admin Portal" screen="admin" badge="HOST" />
          ) : null}

          {!user ? (
            <NavItem icon="sign-in-alt" label="Login / Sign Up" screen="login" />
          ) : null}
        </ScrollView>

        {user ? (
          <TouchableOpacity style={styles.logoutButton} onPress={() => { signOut(); onClose(); }}>
            <FontAwesome5 name="sign-out-alt" size={16} color="#ff4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#291c0e',
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.2)',
    ...Platform.select({
      web: {
        boxShadow: '5px 0 10px rgba(0,0,0,0.5)',
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 5, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 20,
      }
    }),
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  drawerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Trajan Pro' : 'TrajanPro',
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  closeButton: {
    padding: 5,
  },
  navScroll: {
    flex: 1,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 5,
  },
  activeNavItem: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  navIconContainer: {
    width: 30,
    alignItems: 'center',
    marginRight: 15,
  },
  navLabel: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  activeNavLabel: {
    color: '#D4AF37',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    marginVertical: 15,
    marginHorizontal: 20,
  },
  badge: {
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adminBadge: {
    backgroundColor: '#D4AF37',
  },
  vendorBadge: {
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 68, 68, 0.1)',
  },
  logoutText: {
    color: '#ff4444',
    marginLeft: 15,
    fontWeight: 'bold',
    fontSize: 15,
  },
  // Mobile drawer categories styling
  drawerSectionHeader: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 8,
  },
  drawerSectionTitle: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  categoryItemContainer: {
    marginBottom: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryHeaderIcon: {
    width: 24,
    textAlign: 'center',
    marginRight: 15,
  },
  categoryLabel: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '600',
  },
  categorySubList: {
    backgroundColor: 'rgba(212, 175, 55, 0.03)',
    paddingLeft: 44,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(212, 175, 55, 0.15)',
    marginVertical: 4,
  },
  categorySubItem: {
    paddingVertical: 8,
  },
  categorySubItemText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  directCategoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
});

export default SideDrawer;
