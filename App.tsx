import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Session } from '@supabase/supabase-js';
import { CardStyleInterpolators } from '@react-navigation/stack';

// Import screens using require to avoid TypeScript errors
const SplashScreen = require('./src/screens/SplashScreen').default;
const SignInScreen = require('./src/screens/SignInScreen').default;
const SignUpScreen = require('./src/screens/SignUpScreen').default;
const HomeScreen = require('./src/screens/HomeScreen').default;

// Import Supabase client
import { supabase } from './src/services/supabaseClient';

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
    </AuthStack.Navigator>
  );
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
        ) : session ? (
          // User is signed in
          <Stack.Screen name="HomeScreen" component={HomeScreen} />
        ) : (
          // User is not signed in - use the auth navigator
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator} 
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
