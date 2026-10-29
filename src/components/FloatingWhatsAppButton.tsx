import React from 'react';
import { TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { FEATURE_FLAGS } from '../config/features';

export const FloatingWhatsAppButton: React.FC = () => {
  if (!FEATURE_FLAGS.ENABLE_WHATSAPP_INQUIRY) return null;

  const handlePress = () => {
    const phone = FEATURE_FLAGS.WHATSAPP_PHONE_NUMBER;
    const msg = "Namaste Moksha Jewels! I would like to inquire about your jewelry collection.";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  return (
    <TouchableOpacity
      style={styles.floatingBtn}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityLabel="Contact us on WhatsApp"
    >
      <FontAwesome5 name="whatsapp" size={28} color="#ffffff" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  floatingBtn: {
    position: 'absolute',
    right: 20,
    bottom: 25,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
});
