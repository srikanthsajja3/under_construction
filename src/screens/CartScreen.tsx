import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  StatusBar,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Animated
} from 'react-native';
import OptimizedImage from '../components/OptimizedImage';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { useUI } from '../contexts/UIContext';
import { useCart } from '../contexts/CartContext';
import { useCountry } from '../contexts/CountryContext';
import { formatPrice } from '../utils/currency';
import { FEATURE_FLAGS } from '../config/features';
import { FontAwesome5 } from '@expo/vector-icons';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useRef } from 'react';

interface CartScreenProps {
  scrollY?: Animated.Value;
}

const CartScreen: React.FC<CartScreenProps> = ({ scrollY: scrollYProp }) => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { setLoginVisible, scrollY: globalScrollY } = useUI();
  const { cart, removeFromCart, updateQuantity, cartTotal, isLoading } = useCart();
  const { countryCode } = useCountry();
  const { width } = useWindowDimensions();

  const localScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = scrollYProp || globalScrollY || localScrollY;

  const isWeb = Platform.OS === 'web';

  const handleWhatsAppEnquiry = () => {
    const phoneNumber = FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER;
    let itemList = cart.map(item => `- ${item.name} (Qty: ${item.quantity}, ID: ${item.id})`).join('\n');
    
    const message = `Namaste Moksha Jewels! I am interested in these pieces from my bag:
    
${itemList}

Total Amount: ${formatPrice(cartTotal, countryCode)}

Please provide more details on how to proceed with these items.`;
    
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      import('expo-linking').then(Linking => {
        Linking.openURL(url);
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <OptimizedImage url={item.image} style={styles.itemImage} shouldLoad={true} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemCategory}>{item.category}</Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price, countryCode)}</Text>
        
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            style={styles.quantityBtn} 
            onPress={() => updateQuantity(item.id, item.quantity - 1)}
          >
            <Text style={styles.quantityBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity 
            style={styles.quantityBtn} 
            onPress={() => updateQuantity(item.id, item.quantity + 1)}
          >
            <Text style={styles.quantityBtnText}>+</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.removeBtn} 
            onPress={() => removeFromCart(item.id)}
          >
            <Text style={styles.removeBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <Animated.ScrollView 
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrapper}>
          <View style={styles.content}>
            <Text style={styles.title}>Your Shopping Bag</Text>
            
            {isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={[styles.emptyText, { marginTop: 15 }]}>Updating your bag...</Text>
              </View>
            ) : cart.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Your bag is empty.</Text>
                <TouchableOpacity style={styles.shopBtn} onPress={() => navigation.navigate('Home')}>
                  <Text style={styles.shopBtnText}>Start Shopping</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.listContent}>
                  {cart.map(item => (
                    <View key={item.id}>
                      {renderItem({ item })}
                    </View>
                  ))}
                </View>
                
                <View style={styles.footer}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>{formatPrice(cartTotal, countryCode)}</Text>
                  </View>
                  
                  {FEATURE_FLAGS.ENABLE_CHECKOUT ? (
                    <TouchableOpacity style={styles.checkoutBtn} onPress={() => navigation.navigate('Checkout')}>
                      <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.checkoutBtn, { backgroundColor: '#25D366', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]} 
                      onPress={handleWhatsAppEnquiry}
                      activeOpacity={0.8}
                    >
                      <FontAwesome5 name="whatsapp" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={[styles.checkoutBtnText, { color: '#fff' }]}>Inquire Bag on WhatsApp</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
        <Footer />
      </Animated.ScrollView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontFamily: 'TrajanPro',
    fontSize: 24,
    color: '#D4AF37',
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#3d2b1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4a3520',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#291c0e',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  itemName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  itemCategory: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 5,
  },
  itemPrice: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4a3520',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  quantityBtnText: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quantityText: {
    color: '#fff',
    marginHorizontal: 12,
    fontSize: 14,
  },
  removeBtn: {
    marginLeft: 'auto',
  },
  removeBtnText: {
    color: '#ff4444',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  footer: {
    backgroundColor: '#3d2b1a',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
    marginTop: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    color: '#aaa',
    fontSize: 16,
  },
  totalValue: {
    color: '#D4AF37',
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkoutBtn: {
    backgroundColor: '#D4AF37',
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: 'center',
  },
  checkoutBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 20,
  },
  shopBtn: {
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 4,
  },
  shopBtnText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default CartScreen;
