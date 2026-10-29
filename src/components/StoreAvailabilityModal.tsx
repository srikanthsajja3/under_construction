import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Platform,
  Alert
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { Product } from "../data/products";
import OptimizedImage from "./OptimizedImage";
import { FEATURE_FLAGS } from "../config/features";

interface StoreAvailabilityModalProps {
  visible: boolean;
  onClose: () => void;
  product: Product;
  countryCode: string;
  matchingProducts: Product[];
  onSelectProduct?: (product: Product) => void;
}

const AVAILABLE_PINCODES = [
  "520010", "520001", "520002", "520003", // Vijayawada
  "560001", "560002", "560038", "560011", "560012", "560076", // Bangalore
  "110001", "110011", "110021", "110002", // Delhi
  "400001", "400002", "400050", "400003"  // Mumbai
];

const STORES_BY_REGION: Record<string, string[]> = {
  "52": [
    "Moksha Jewels Flagship Showroom, Polyclinic Road, Vijayawada",
    "Moksha Boutique Store, MG Road, Vijayawada"
  ],
  "56": [
    "Moksha Jewels Experience Center, Indiranagar, Bengaluru",
    "Moksha Jewels Showroom, Jayanagar 4th Block, Bengaluru"
  ],
  "11": [
    "Moksha Jewels Flagship Salon, Connaught Place, New Delhi",
    "Moksha Jewels Boutique, South Extension I, New Delhi"
  ],
  "40": [
    "Moksha Jewels Premium Salon, Colaba Causeway, Mumbai",
    "Moksha Jewels Showroom, Bandra West, Mumbai"
  ]
};

export const StoreAvailabilityModal: React.FC<StoreAvailabilityModalProps> = ({
  visible,
  onClose,
  product,
  countryCode,
  matchingProducts,
  onSelectProduct
}) => {
  const [currentScreen, setCurrentScreen] = useState<"search" | "unavailable">("search");
  const [pincode, setPincode] = useState<string>("");
  const [activeCheckedSku, setActiveCheckedSku] = useState<string | null>(null);
  
  // Lead form states
  const [showLeadForm, setShowLeadForm] = useState<boolean>(false);
  const [leadName, setLeadName] = useState<string>("");
  const [leadPhone, setLeadPhone] = useState<string>("");
  
  // Validation errors
  const [nameError, setNameError] = useState<boolean>(false);
  const [phoneError, setPhoneError] = useState<boolean>(false);

  // Store results visibility
  const [showStores, setShowStores] = useState<boolean>(false);
  const [storesList, setStoresList] = useState<string[]>([]);

  // Not available states
  const [expertThanks, setExpertThanks] = useState<boolean>(false);

  // Reset modal state on close/open
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  const resetState = () => {
    setCurrentScreen("search");
    setPincode("");
    setActiveCheckedSku(null);
    setShowLeadForm(false);
    setLeadName("");
    setLeadPhone("");
    setNameError(false);
    setPhoneError(false);
    setShowStores(false);
    setStoresList([]);
    setExpertThanks(false);
  };

  // Format currency helpers
  const formatPrice = (price: number) => {
    const isIndia = countryCode === "IN";
    const localizedPrice = isIndia ? price * 83 : price;
    return isIndia
      ? `₹${Math.round(localizedPrice).toLocaleString("en-IN")}`
      : `$${localizedPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Input handlers
  const handlePincodeChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPincode(cleaned);
  };

  const handleNameChange = (text: string) => {
    setLeadName(text);
    if (text.trim().length > 0 && text.trim().length < 3) {
      setNameError(true);
    } else {
      setNameError(false);
    }
  };

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setLeadPhone(cleaned);
    if (cleaned.length > 0 && cleaned.length !== 10) {
      setPhoneError(true);
    } else {
      setPhoneError(false);
    }
  };

  // Actions
  const handleCheckAvailability = (sku: string) => {
    if (pincode.length !== 6) return;

    setActiveCheckedSku(sku);

    if (AVAILABLE_PINCODES.includes(pincode)) {
      // Pincode is available, prompt for lead info
      setShowLeadForm(true);
      setShowStores(false);
    } else {
      // Pincode is NOT available, transition to the unavailable screen
      setCurrentScreen("unavailable");
    }
  };

  const handleSubmitLead = () => {
    const isNameInvalid = leadName.trim().length < 3;
    const isPhoneInvalid = leadPhone.length !== 10;

    setNameError(isNameInvalid);
    setPhoneError(isPhoneInvalid);

    if (isNameInvalid || isPhoneInvalid) return;

    // Determine stores based on region (first 2 digits of pincode)
    const prefix = pincode.substring(0, 2);
    const regionStores = STORES_BY_REGION[prefix] || [
      "Moksha Jewels Vijayawada Showroom, Polyclinic Road"
    ];

    setStoresList(regionStores);
    setShowStores(true);
  };

  const handleTalkToExpert = () => {
    setExpertThanks(true);
  };

  const handleTryAtStore = () => {
    Alert.alert(
      "Try at Store Request Sent",
      "Our showroom experts will contact you within 24 hours to coordinate your private viewing.",
      [{ text: "Okay" }]
    );
  };

  // Validate lead form for enabling button
  const isLeadValid = leadName.trim().length >= 3 && leadPhone.length === 10;
  const isPincodeValid = pincode.length === 6;

  // Selected products for selection list (include current product and first matching complementary item)
  const selectionProducts = [
    product,
    ...(matchingProducts && matchingProducts.length > 0 ? [matchingProducts[0]] : [])
  ];

  // Similar products for recommended grid in Case B
  const similarProducts = matchingProducts && matchingProducts.length > 0
    ? matchingProducts.slice(0, 2)
    : [];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.popupContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {currentScreen === "search" ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View id="threePdp-main-screen" style={styles.screenWrapper}>
                <Text style={styles.mainTitle}>Your selections await.</Text>
                <Text style={styles.subTitle}>
                  Enter your PIN to check availability at a Tanishq store near you.
                </Text>

                {/* PIN Code Field */}
                <View style={styles.pinSection}>
                  <Text style={styles.label}>ENTER PIN CODE</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 560001"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="numeric"
                    maxLength={6}
                    value={pincode}
                    onChangeText={handlePincodeChange}
                  />
                </View>

                {/* Product List */}
                <View style={styles.productListContainer}>
                  {selectionProducts.map((prod, index) => {
                    const isCheckingThis = activeCheckedSku === prod.productCode;
                    return (
                      <View key={prod.id || index} style={styles.productCard}>
                        <OptimizedImage
                          url={prod.image}
                          style={styles.prodImage}
                          shouldLoad={true}
                        />
                        <Text style={styles.prodName} numberOfLines={2}>{prod.name}</Text>
                        {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.prodPrice}>{formatPrice(prod.price)}</Text> : null}
                        
                        <TouchableOpacity
                          style={[
                            styles.checkBtn,
                            !isPincodeValid && styles.checkBtnDisabled,
                            isCheckingThis && showLeadForm && styles.checkBtnActive
                          ]}
                          disabled={!isPincodeValid}
                          onPress={() => handleCheckAvailability(prod.productCode)}
                          activeOpacity={0.8}
                        >
                          <Text style={[
                            styles.checkBtnText,
                            !isPincodeValid && styles.checkBtnTextDisabled
                          ]}>
                            Check Store Availability
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>

                {/* Inline Lead Form */}
                {showLeadForm && (
                  <View style={styles.leadFormInline}>
                    <Text style={styles.leadFormTitle}>Share your details to see store results.</Text>
                    <View style={styles.leadFieldsContainer}>
                      <Text style={styles.label}>NAME</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your name"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        value={leadName}
                        onChangeText={handleNameChange}
                      />
                      {nameError && (
                        <Text style={styles.errorText}>Please enter a valid name (min 3 characters).</Text>
                      )}

                      <Text style={[styles.label, { marginTop: 15 }]}>PHONE NUMBER</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter mobile number"
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        keyboardType="phone-pad"
                        maxLength={10}
                        value={leadPhone}
                        onChangeText={handlePhoneChange}
                      />
                      {phoneError && (
                        <Text style={styles.errorText}>Please enter a valid 10-digit number.</Text>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.submitLeadBtn,
                          !isLeadValid && styles.submitLeadBtnDisabled
                        ]}
                        disabled={!isLeadValid}
                        onPress={handleSubmitLead}
                        activeOpacity={0.8}
                      >
                        <Text style={[
                          styles.submitLeadBtnText,
                          !isLeadValid && styles.submitLeadBtnTextDisabled
                        ]}>
                          SUBMIT & VIEW STORES
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Store Results */}
                {showStores && (
                  <View style={styles.storeResultsSection}>
                    <View style={styles.divider} />
                    <Text style={styles.storeResultsHeader}>Available in</Text>
                    <View style={styles.storesListContainer}>
                      {storesList.map((store, i) => (
                        <View key={i} style={styles.storeRow}>
                          <FontAwesome5 name="map-marker-alt" size={14} color="#D4AF37" style={{ marginRight: 10, marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.storeName}>{store}</Text>
                            <Text style={styles.storeDetails}>Hours: 10:30 AM - 8:30 PM | Open Daily</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          ) : (
            /* Unavailable Screen */
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View id="threePdp-not-available-screen" style={styles.screenWrapper}>
                <View style={styles.bannerUnavailable}>
                  <Text style={styles.bannerUnavailableText}>NOT AVAILABLE IN YOUR PINCODE</Text>
                </View>

                <Text style={styles.mainTitle}>You might also love these.</Text>
                <Text style={styles.subTitle}>
                  Available at our nearest store — curated just for you.
                </Text>

                {/* Similar curated list */}
                {similarProducts.length > 0 ? (
                  <View style={styles.similarProductsGrid}>
                    {similarProducts.map((prod, index) => (
                      <TouchableOpacity
                        key={prod.id || index}
                        style={styles.similarProductCard}
                        onPress={() => {
                          if (onSelectProduct) {
                            onSelectProduct(prod);
                          }
                          onClose();
                        }}
                        activeOpacity={0.8}
                      >
                        <OptimizedImage
                          url={prod.image}
                          style={styles.similarProdImage}
                          shouldLoad={true}
                        />
                        <Text style={styles.similarProdName} numberOfLines={1}>{prod.name}</Text>
                        {FEATURE_FLAGS.SHOW_PRICES ? <Text style={styles.similarProdPrice}>{formatPrice(prod.price)}</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: "rgba(255, 255, 255, 0.4)", fontSize: 12, textAlign: "center", marginVertical: 15 }}>
                    Loading suggestions...
                  </Text>
                )}

                {/* Nearest store info */}
                <View style={styles.nearestStoreInfoCard}>
                  <FontAwesome5 name="store" size={16} color="#D4AF37" style={{ marginBottom: 8 }} />
                  <Text style={styles.nearestStoreLabel}>NEAREST AVAILABLE SHOWROOM</Text>
                  <Text style={styles.nearestStoreName}>
                    Moksha Jewels Flagship Showroom, Vijayawada
                  </Text>
                  <Text style={styles.nearestStoreDistance}>
                    Polyclinic Road, Vijayawada (~120 km away)
                  </Text>
                </View>

                {/* Action footer */}
                <View style={styles.actionFooter}>
                  {expertThanks && (
                    <Text style={styles.expertThanksText}>
                      Our Experts will get in touch with you.
                    </Text>
                  )}

                  {!expertThanks && (
                    <TouchableOpacity style={styles.btnOutline} onPress={handleTalkToExpert} activeOpacity={0.8}>
                      <Text style={styles.btnOutlineText}>TALK TO AN EXPERT</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.btnDark} onPress={handleTryAtStore} activeOpacity={0.8}>
                    <Text style={styles.btnDarkText}>TRY AT STORE</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.backLinkBtn} onPress={resetState} activeOpacity={0.7}>
                  <Text style={styles.backLinkLabel}>← TRY ANOTHER PIN CODE</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16
  },
  popupContainer: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
    backgroundColor: "#1a120b",
    borderWidth: 1.5,
    borderColor: "#D4AF37",
    borderRadius: 12,
    position: "relative",
    overflow: "hidden"
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 100,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 16
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold"
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 40
  },
  screenWrapper: {
    width: "100%"
  },
  mainTitle: {
    fontFamily: Platform.OS === "web" ? "Trajan Pro" : "TrajanPro",
    fontSize: 20,
    color: "#D4AF37",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase"
  },
  subTitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 24
  },
  pinSection: {
    marginBottom: 20
  },
  label: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#D4AF37",
    letterSpacing: 1,
    marginBottom: 6,
    textTransform: "uppercase"
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#4a3520",
    borderRadius: 6,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 14,
    backgroundColor: "#291c0e",
    ...Platform.select({
      web: {
        outlineStyle: "none" as any
      }
    })
  },
  productListContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24
  },
  productCard: {
    flex: 1,
    backgroundColor: "#201409",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    justifyContent: "space-between"
  },
  prodImage: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    backgroundColor: "#1a120b",
    marginBottom: 8
  },
  prodName: {
    fontFamily: Platform.OS === "web" ? "Trajan Pro" : "TrajanPro",
    fontSize: 11,
    color: "#fff",
    textAlign: "center",
    height: 32,
    lineHeight: 15,
    marginBottom: 4
  },
  prodPrice: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#D4AF37",
    marginBottom: 10
  },
  checkBtn: {
    width: "100%",
    backgroundColor: "#D4AF37",
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: "center"
  },
  checkBtnDisabled: {
    backgroundColor: "#4a3520",
    opacity: 0.5
  },
  checkBtnActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D4AF37"
  },
  checkBtnText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  checkBtnTextDisabled: {
    color: "rgba(255, 255, 255, 0.4)"
  },
  leadFormInline: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(212, 175, 55, 0.15)",
    paddingTop: 20,
    width: "100%"
  },
  leadFormTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 16
  },
  leadFieldsContainer: {
    width: "100%"
  },
  errorText: {
    color: "#ff4d4d",
    fontSize: 10,
    marginTop: 4,
    marginLeft: 2
  },
  submitLeadBtn: {
    width: "100%",
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 20
  },
  submitLeadBtnDisabled: {
    backgroundColor: "#4a3520",
    opacity: 0.5
  },
  submitLeadBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  submitLeadBtnTextDisabled: {
    color: "rgba(255, 255, 255, 0.4)"
  },
  storeResultsSection: {
    marginTop: 20,
    width: "100%"
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(212, 175, 55, 0.15)",
    marginVertical: 16
  },
  storeResultsHeader: {
    fontFamily: Platform.OS === "web" ? "Trajan Pro" : "TrajanPro",
    fontSize: 14,
    color: "#D4AF37",
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: "uppercase"
  },
  storesListContainer: {
    gap: 12
  },
  storeRow: {
    flexDirection: "row",
    backgroundColor: "#201409",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.1)",
    borderRadius: 6,
    padding: 12
  },
  storeName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4
  },
  storeDetails: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11
  },

  /* Unavailable Screen Styles */
  bannerUnavailable: {
    backgroundColor: "#ff4d4d",
    paddingVertical: 8,
    borderRadius: 4,
    width: "100%",
    alignItems: "center",
    marginBottom: 20
  },
  bannerUnavailableText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1
  },
  similarProductsGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24
  },
  similarProductCard: {
    flex: 1,
    backgroundColor: "#201409",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center"
  },
  similarProdImage: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    backgroundColor: "#1a120b",
    marginBottom: 8
  },
  similarProdName: {
    fontFamily: Platform.OS === "web" ? "Trajan Pro" : "TrajanPro",
    fontSize: 11,
    color: "#fff",
    textAlign: "center",
    marginBottom: 4
  },
  similarProdPrice: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#D4AF37"
  },
  nearestStoreInfoCard: {
    backgroundColor: "#201409",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
    width: "100%"
  },
  nearestStoreLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#D4AF37",
    letterSpacing: 1,
    marginBottom: 6
  },
  nearestStoreName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4
  },
  nearestStoreDistance: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    textAlign: "center"
  },
  actionFooter: {
    width: "100%",
    gap: 12,
    marginBottom: 24
  },
  expertThanksText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 6
  },
  btnOutline: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: "center"
  },
  btnOutlineText: {
    color: "#D4AF37",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  btnDark: {
    width: "100%",
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: "center"
  },
  btnDarkText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1
  },
  backLinkBtn: {
    alignSelf: "center",
    padding: 8
  },
  backLinkLabel: {
    color: "#D4AF37",
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 0.5
  }
});
