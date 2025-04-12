import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Correct Supabase credentials from the current .env file
const SUPABASE_URL = 'https://nzszodtmwrdqoakabgep.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56c3pvZHRtd3JkcW9ha2FiZ2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1MDAwOTUsImV4cCI6MjA2MDA3NjA5NX0.K0hstCduVP64_9WWlWllDlLOnLcspRoAOcPv2MQ4H3I';

// For debug: Log Supabase connection attempt
console.log(`Attempting to connect to Supabase at: ${SUPABASE_URL}`);

// Create Supabase client
let supabase;

try {
  console.log('Creating Supabase client');
  
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  console.log('Supabase client created successfully');
} catch (error) {
  console.error('Error creating Supabase client:', error);
  // Create a dummy client in case of error
  supabase = { auth: { signUp: () => Promise.reject(new Error('Supabase connection failed')) } };
}

export { supabase }; 