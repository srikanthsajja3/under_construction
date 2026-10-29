/**
 * Central Feature Flags Configuration
 * Used to toggle features on/off without removing any underlying code.
 */

export const FEATURE_FLAGS = {
  // Set to false to disable cart icon in Header and checkout/payment processing
  ENABLE_CHECKOUT: false,
  ENABLE_CART: false,
  ENABLE_ORDERS: false,

  // Prices and Live Gold Rate displays (turned off for pure inquiry mode)
  SHOW_PRICES: false,
  SHOW_GOLD_RATES: false,
  SHOW_PRICE_BREAKUP: false,

  // Product specs: Display only Gross Weight, Net Weight, and Purity
  SHOW_ONLY_BASIC_SPECS: true,

  // Enable WhatsApp catalog inquiry mode
  ENABLE_WHATSAPP_INQUIRY: true,

  // WhatsApp business contact number (country code + number, digits only)
  WHATSAPP_PHONE_NUMBER: process.env.EXPO_PUBLIC_WHATSAPP_NUMBER || "919922244439",
};
