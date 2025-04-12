import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import Modal from "react-native-modal";
import { signOut } from "../services/authService";

const { height } = Dimensions.get("window");

const HomeScreen = ({ navigation }) => {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isModalVisible, setModalVisible] = useState(false);

  const handleMarkerPress = (markerData) => {
    setSelectedMarker(markerData);
    setModalVisible(true); // show or re-show modal
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedMarker(null);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 38.9869,
          longitude: -76.9426,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
      >
        <Marker
          coordinate={{ latitude: 38.989037, longitude: -76.936385 }}
          onPress={() =>
            handleMarkerPress({
              title: "App Dev Club Symposium",
              description:
                "Come and check out the project teams, network with project leads, and learn more about App Dev Club in general! Also, you can get application tips. Food and snacks provided!",
            })
          }
        />
        <Marker
          coordinate={{
            latitude: 38.98612051128159,
            longitude: -76.94475560609986,
          }}
          onPress={() =>
            handleMarkerPress({
              title: "Fawzi CMSC250 Study Session",
              description:
                "Come join us to study for the upcoming CMSC250 Exam tomorrow. We will cover everything that we need to know. Anyone and everyone is welcome to this session.",
            })
          }
        />
      </MapView>

      {/* Bottom Popup Modal */}
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={closeModal}
        swipeDirection="down"
        onSwipeComplete={closeModal}
        style={styles.modal}
        backdropOpacity={0.1} // ⬅️ allow tap outside
      >
        <View style={styles.popup}>
          <Image
            source={{
              uri: "https://engineering.jhu.edu/ams/wp-content/uploads/2021/06/hero-image-research-500x282.jpeg",
            }}
            style={styles.modalImage}
          />
          <View style={styles.modalContent}>
            <View>
              <Text style={styles.title}>{selectedMarker?.title}</Text>
              <Text
                style={{
                  color: "gray",
                  fontSize: 15,
                  marginTop: 20,
                  marginBottom: 5,
                  fontWeight: "bold",
                }}
              >
                📍 49 Baltimore Ave, College Park, MD
              </Text>
              <Text
                style={{
                  color: "gray",
                  fontSize: 15,
                  marginBottom: 25,
                  fontWeight: "bold",
                }}
              >
                🕒 6:00PM-9:30PM
              </Text>
              <Text style={styles.description}>
                {selectedMarker?.description}
              </Text>
            </View>
            <TouchableOpacity>
              <View style={styles.joinButton}>
                <Text style={styles.joinText}>View Details</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  modal: {
    justifyContent: "flex-end",
    margin: 0,
  },
  popup: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: height * 0.6,
    overflow: "hidden", // important for rounded corners
  },
  modalImage: {
    width: "100%",
    height: "25%", // covers top half
  },
  modalContent: {
    flex: 1,
    padding: 30,
    justifyContent: "space-between",
  },
  joinButton: {
    backgroundColor: "purple",
    padding: 15,
    borderRadius: 10,
  },
  joinText: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
    fontSize: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "purple"
  },
  description: {
    fontSize: 15,
    color: "#555",
  },
});

export default HomeScreen;
