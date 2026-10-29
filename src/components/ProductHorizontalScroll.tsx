import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  Dimensions,
  Platform 
} from 'react-native';
import OptimizedImage from './OptimizedImage';
import { Product } from '../data/products';
import { formatPrice } from '../utils/currency';
import { FEATURE_FLAGS } from '../config/features';
import { useCountry } from '../contexts/CountryContext';

interface ProductHorizontalScrollProps {
  title: string;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width > 768 ? 240 : 180;

const ProductHorizontalScroll: React.FC<ProductHorizontalScrollProps> = ({ 
  title, 
  products, 
  onSelectProduct 
}) => {
  const { countryCode } = useCountry();

  if (products.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.line} />
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onSelectProduct(item)}
          >
            <View style={styles.imageContainer}>
              <OptimizedImage 
                url={item.image} 
                style={styles.image} 
                shouldLoad={true} // Small list, load immediately
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>NEW</Text>
              </View>
            </View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.price}>{formatPrice(item.price, countryCode)}</Text> : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 30,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  title: {
    fontFamily: 'TrajanPro',
    fontSize: 20,
    color: '#D4AF37',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#3d2b1a',
    borderRadius: 10,
    marginRight: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#4a3520',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: {
        elevation: 4,
      },
      web: {
        transition: 'transform 0.3s ease',
        cursor: 'pointer',
      }
    }),
  },
  imageContainer: {
    height: CARD_WIDTH * 1.2,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  badgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  info: {
    padding: 12,
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  price: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProductHorizontalScroll;
