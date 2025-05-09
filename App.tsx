import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { Session } from "@supabase/supabase-js";
import { CardStyleInterpolators } from "@react-navigation/stack";
import { Alert } from "react-native";
import BottomTabs from "./src/components/BottomTabs";
// Import screens using require to avoid TypeScript errors
const SplashScreen = require("./src/screens/SplashScreen").default;
const SignInScreen = require("./src/screens/SignInScreen").default;
const SignUpScreen = require("./src/screens/SignUpScreen").default;
const OnboardingScreen = require("./src/screens/OnboardingScreen").default;
const MapScreen = require("./src/screens/MapScreen").default;

// Import Supabase client
import { supabase } from "./src/services/supabaseClient";

const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

// Auth navigator component with custom transitions
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        }}
      />
      <AuthStack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      />
      <AuthStack.Screen
        name="OnboardingScreen"
        component={OnboardingScreen}
        options={{
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
          // Prevent going back to sign up screen during onboarding
          gestureEnabled: false,
        }}
      />
      {/* MapScreen moved to MainApp navigation */}
    </AuthStack.Navigator>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null);

  // Function to handle onboarding navigation from SignUpScreen
  const startOnboarding = (userData) => {
    console.log("startOnboarding called with data:", userData ? JSON.stringify(userData) : "null");
    
    if (userData === null) {
      // This is called when onboarding is complete
      setIsOnboarding(false);
      return;
    }
    
    // Validate the data before setting it
    if (!userData || !userData.userId) {
      console.error("Invalid user data provided to startOnboarding:", userData);
      Alert.alert("Error", "Invalid user data for onboarding");
      return;
    }
    
    setOnboardingData(userData);
    setIsOnboarding(true);
  };

  // Expose the function globally for use in SignUpScreen
  if (typeof global !== 'undefined') {
    global.startOnboarding = startOnboarding;
  }

  useEffect(() => {
    // Show splash screen for 1.5 seconds
    const splashTimeout = setTimeout(() => {
      setShowSplash(false);
    }, 1500);

    // Check if user is already signed in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      clearTimeout(splashTimeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading && showSplash) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {showSplash ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : isOnboarding && onboardingData ? (
          // If user is in onboarding flow, show OnboardingScreen
          <Stack.Screen name="Onboarding">
            {props => {
              console.log("Rendering OnboardingScreen with data:", JSON.stringify(onboardingData));
              return <OnboardingScreen 
                {...props} 
                route={{ params: onboardingData }} 
              />;
            }}
          </Stack.Screen>
        ) : session ? (
          // ✅ Use Bottom Tabs if user is signed in
          <Stack.Screen name="MainApp" component={BottomTabs} />
        ) : (
          // ❌ Auth screens if not signed in
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
