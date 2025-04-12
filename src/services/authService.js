import { supabase } from './supabaseClient';

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
    // Disable email confirmation by setting emailRedirectTo to null
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: null,
      },
    });
    
    if (error) throw error;
    
    // Fallback: Manually create user profile if the trigger doesn't work
    if (data.user) {
      try {
        // Check if user profile exists
        const { data: profile, error: profileCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single();
          
        // If profile doesn't exist or there was an error checking, create it
        if (profileCheckError || !profile) {
          console.log('Creating user profile manually as fallback...');
          const { error: insertError } = await supabase.from('users').upsert({
            id: data.user.id,
            name: name,
            email: email,
            avatar_url: null,
            calendar: JSON.stringify([])
          });
          
          if (insertError) {
            console.error('Error in manual profile creation:', insertError.message);
          }
        }
      } catch (profileError) {
        console.error('Error checking/creating user profile:', profileError.message);
      }
    }
    
    // Auto sign-in after signup (this step is technically not needed with Supabase's current behavior,
    // but we're including it for clarity and to ensure consistent behavior)
    if (!data.session) {
      console.log('No session after signup, performing manual sign-in');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) {
        console.error('Error signing in after signup:', signInError.message);
      }
    } else {
      console.log('Session automatically created after signup');
    }
    
    return data.user;
  } catch (error) {
    console.error('Error signing up:', error.message);
    throw error;
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
    
    // Attempt to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Sign in error details:', error);
      
      // Provide more friendly error messages based on the error code
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        throw new Error('Please confirm your email address before signing in.');
      } else {
        throw error;
      }
    }
    
    // Additional check to make sure we have user data
    if (!data || !data.user) {
      console.error('Sign in succeeded but no user data was returned');
      throw new Error('Sign in failed. Please try again.');
    }
    
    console.log('Sign in successful for user:', data.user.id);
    return data.user;
  } catch (error) {
    console.error('Error signing in:', error.message);
    throw error;
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
    console.error('Error signing out:', error.message);
    throw error;
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
    console.error('Error getting user profile:', error.message);
    throw error;
  }
}; 