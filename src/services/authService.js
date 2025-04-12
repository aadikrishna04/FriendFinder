import { supabase } from './supabaseClient';

/**
 * Error handler utility to provide consistent error messages
 * @param {Error} error - The error object
 * @param {string} fallbackMessage - Fallback message if error doesn't have a message
 * @returns {Error} - Error with appropriate message
 */
const handleError = (error, fallbackMessage) => {
  console.error(`Auth Error: ${error.message || fallbackMessage}`);
  
  // Map common errors to user-friendly messages
  if (error.message?.includes('Invalid login credentials')) {
    return new Error('Invalid email or password. Please try again.');
  } else if (error.message?.includes('Email not confirmed')) {
    return new Error('Please confirm your email address before signing in.');
  } else if (error.message?.includes('User already registered')) {
    return new Error('An account with this email already exists.');
  } else if (error.message?.includes('Password should be at least')) {
    return new Error('Password should be at least 6 characters long.');
  }
  
  return error.message ? error : new Error(fallbackMessage);
};

/**
 * Sign up a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's full name
 * @returns {Promise<object>} - The created user object
 */
export const signUp = async (email, password, name) => {
  try {
    // Create user in Supabase Auth with user metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: null, // Disable email confirmation
      },
    });
    
    if (error) throw error;
    
    // Fallback: Manually create user profile if the trigger doesn't work
    if (data.user) {
      try {
        await ensureUserProfile(data.user.id, {
          name,
          email,
          avatar_url: null,
          calendar: JSON.stringify([])
        });
      } catch (profileError) {
        console.error('Error ensuring user profile:', profileError.message);
        // Continue anyway since the auth record was created
      }
    }
    
    // Auto sign-in after signup if needed
    if (!data.session) {
      console.log('No session after signup, performing manual sign-in');
      await manualSignIn(email, password);
    } else {
      console.log('Session automatically created after signup');
    }
    
    return data.user;
  } catch (error) {
    throw handleError(error, 'Failed to sign up. Please try again.');
  }
};

/**
 * Sign in an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<object>} - The authenticated user object
 */
export const signIn = async (email, password) => {
  try {
    console.log(`Attempting to sign in with email: ${email}`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (!data?.user) {
      throw new Error('Sign in failed. No user data returned.');
    }
    
    console.log('Sign in successful for user:', data.user.id);
    return data.user;
  } catch (error) {
    throw handleError(error, 'Failed to sign in. Please try again.');
  }
};

/**
 * Helper function for manual sign-in
 * @private
 */
const manualSignIn = async (email, password) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Error signing in after signup:', error.message);
    }
  } catch (error) {
    console.error('Error in manual sign-in:', error.message);
  }
};

/**
 * Ensure user profile exists in the users table
 * @private
 */
const ensureUserProfile = async (userId, userData) => {
  // Check if user profile exists
  const { data: profile, error: profileCheckError } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();
    
  // If profile doesn't exist or there was an error checking, create it
  if (profileCheckError || !profile) {
    console.log('Creating user profile...');
    const { error: insertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        ...userData
      });
    
    if (insertError) {
      throw insertError;
    }
  }
};

/**
 * Sign out the current user
 */
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    throw handleError(error, 'Failed to sign out. Please try again.');
  }
};

/**
 * Get the current user's profile data
 * @returns {Promise<object>} - The user's profile data
 */
export const getUserProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not found');

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return profile;
  } catch (error) {
    throw handleError(error, 'Failed to get user profile. Please try again.');
  }
}; 