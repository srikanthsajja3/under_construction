import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WifiOff, RotateCw } from "lucide-react-native";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    Platform.OS === "web" ? typeof navigator !== "undefined" ? navigator.onLine : true : true
  );

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const checkConnection = async (): Promise<boolean> => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    try {
      // Ping a fast endpoint or check fetch
      const response = await fetch("https://www.google.com/favicon.ico", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
      });
      setIsOnline(true);
      return true;
    } catch {
      setIsOnline(false);
      return false;
    }
  };

  return { isOnline, checkConnection, setIsOnline };
}

interface NoNetworkScreenProps {
  onRetry?: () => void;
}

export function NoNetworkScreen({ onRetry }: NoNetworkScreenProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const { checkConnection } = useNetworkStatus();

  const handleRetry = async () => {
    setIsRetrying(true);
    const connected = await checkConnection();
    setIsRetrying(false);
    if (connected && onRetry) {
      onRetry();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentCard}>
        <View style={styles.iconContainer}>
          <WifiOff size={56} color="#D4AF37" />
        </View>

        <Text style={styles.title}>No Internet Connection</Text>

        <Text style={styles.subtitle}>
          It looks like you're offline. Please check your cellular data or Wi-Fi settings and try again.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isRetrying}
          activeOpacity={0.8}
        >
          {isRetrying ? (
            <ActivityIndicator size="small" color="#1A120B" />
          ) : (
            <View style={styles.buttonContent}>
              <RotateCw size={18} color="#1A120B" style={styles.buttonIcon} />
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function NoNetworkWrapper({ children }: { children: React.ReactNode }) {
  const { isOnline, checkConnection } = useNetworkStatus();

  if (!isOnline) {
    return <NoNetworkScreen onRetry={checkConnection} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#291c0e",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  contentCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1f140a",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(212, 175, 55, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.3)",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#D1C7BD",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  retryButton: {
    width: "100%",
    height: 48,
    backgroundColor: "#D4AF37",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  retryButtonText: {
    color: "#1A120B",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
