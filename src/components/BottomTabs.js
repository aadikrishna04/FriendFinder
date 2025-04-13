import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import MapScreen from "../screens/MapScreen";
import EventsScreen from "../screens/EventsScreen";
import CreateEventScreen from "../screens/CreateEventScreen";
import EditEventScreen from "../screens/EditEventScreen";
import EventDetailsScreen from "../screens/EventDetailsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import NotificationScreen from "../screens/NotificationScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import Icon from "react-native-vector-icons/Ionicons"; // or MaterialIcons, Feather etc.
import { TouchableOpacity, Platform } from "react-native";
import GroupsScreen from "../screens/GroupsScreen";
import GroupDetailScreen from "../screens/GroupDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Create a stack navigator for the events flow
const EventsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsList" component={EventsScreen} />
      <Stack.Screen name="OnboardingScreen" component={OnboardingScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EditEvent" component={EditEventScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
};

// Create a stack navigator for the map flow
const MapStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MapView" component={MapScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="EditEventScreen" component={EditEventScreen} />
      <Stack.Screen name="OnboardingScreen" component={OnboardingScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
};

// Create a stack navigator for the notifications flow
const NotificationsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NotificationsMain" component={NotificationScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
};

// Groups stack navigator
const GroupsStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="GroupsScreen"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="GroupsScreen" component={GroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
};

const BottomTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Map") {
            iconName = focused ? "map" : "map-outline";
          } else if (route.name === "My Events") {
            iconName = focused ? "calendar" : "calendar-outline";
          } else if (route.name === "Notifications") {
            iconName = focused ? "notifications" : "notifications-outline";
          } else if (route.name === "Groups") {
            iconName = focused ? "people" : "people-outline";
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#8c07b5",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#ebebeb",
          paddingTop: 10,
          height: Platform.OS === "ios" ? 90 : 70,
          paddingBottom: Platform.OS === "ios" ? 25 : 10,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderLeftWidth: 0.2,
          borderRightWidth: 0.2,
          borderTopWidth: 0.2,
          position: "absolute",
          overflow: "hidden",
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          paddingBottom: 5,
        },
      })}
    >
      <Tab.Screen name="Map" component={MapStack} />
      <Tab.Screen name="My Events" component={EventsStack} />
      <Tab.Screen name="Groups" component={GroupsStack} />
      <Tab.Screen name="Notifications" component={NotificationsStack} />
    </Tab.Navigator>
  );
};

export default BottomTabs;
