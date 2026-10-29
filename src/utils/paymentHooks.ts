import { Alert, Platform } from 'react-native';

let RazorpayCheckout: any = null;

if (Platform.OS !== 'web') {
  try {
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch (e) {
    console.warn("Native Razorpay module not found. Payments will work in a Development Build or on Web.");
  }
}

export const usePaymentGateway = (countryCode: string) => {
  const handleRazorpayPayment = async (params: { 
    amount: number; 
    currency?: string; 
    email?: string; 
    name?: string;
    phone?: string;
  }) => {
    if (!RazorpayCheckout) {
      Alert.alert("Development Build Required", "Razorpay native module is not available in Expo Go. Please test on Web or in a Development Build.");
      return { error: { code: 'Unavailable', message: 'Module not found' } };
    }
    try {
      const currency = params.currency || (countryCode === 'IN' ? 'INR' : 'USD');
      const razorpayKey = process.env.EXPO_PUBLIC_RAZORPAY_KEY || 'rzp_test_placeholder';

      const options = {
        description: `Moksha Jewels Purchase (${currency} ${params.amount})`,
        image: 'https://i.imgur.com/3giU0H1.png',
        currency: currency,
        key: razorpayKey, 
        amount: Math.round((params.amount || 0) * 100),
        name: 'MOKSHA JEWELS',
        prefill: { 
          name: params.name || '',
          email: params.email || '',
          contact: params.phone || ''
        },
        theme: { color: '#D4AF37' }
      };
      const data = await RazorpayCheckout.open(options);
      return { error: null, payment_id: data.razorpay_payment_id };
    } catch (error: any) {
      if (error?.code === 0 || error?.description?.includes('cancel')) {
        return { error: { code: 'Canceled', message: 'User canceled payment' } };
      }
      return { error: { code: 'Failed', message: error?.description || error?.message || 'Payment failed' } };
    }
  };

  return {
    initPaymentSheet: async (_params?: any) => ({ error: null }),
    presentPaymentSheet: handleRazorpayPayment,
    isAvailable: Platform.OS === 'web' ? true : !!RazorpayCheckout,
    provider: 'razorpay'
  };
};
