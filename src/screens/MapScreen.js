import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { signOut } from "../services/authService";

const { height } = Dimensions.get("window");

const HomeScreen = ({ navigation }) => {
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 38.9869,
          longitude: -76.9426,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker
          coordinate={{ latitude: 38.989037, longitude: -76.936385 }}
          title="Study Session for CMSC330"
          description="📍 CAL1294, California Hall"
        />
      </MapView>

      {/* <View style={styles.footer}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  map: {
    height:
      height + (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0),
    width: "100%",
  },
  footer: {
    padding: 20,
  },
  signOutButton: {
    backgroundColor: "#8B5CF6",
    height: 54,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  signOutButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});

export default HomeScreen;
