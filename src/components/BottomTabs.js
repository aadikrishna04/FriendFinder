import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ProfileScreen from "../screens/ProfileScreen";
import MapScreen from "../screens/MapScreen";
import Icon from "react-native-vector-icons/Ionicons"; // or MaterialIcons, Feather etc.

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "My Map") {
            iconName = focused ? "map" : "map-outline";
          } else if (route.name === "Events") {
            iconName = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#8c07b5",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#ebebeb",
          paddingTop: 10, // 👈 Adds top padding
          height: 90, // Make sure the height is enough to include padding
        },
      })}
    >
      <Tab.Screen name="My Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Events" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabs;
