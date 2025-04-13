import { supabase } from './supabaseClient';

/**
 * Error handler utility to provide consistent error messages
 * @param {Error} error - The error object
 * @param {string} fallbackMessage - Fallback message if error doesn't have a message
 * @returns {Error} - Error with appropriate message
 */
const handleError = (error, fallbackMessage) => {
  console.error(`Auth Error: ${error.message || fallbackMessage}`);
  console.error('Full error details:', JSON.stringify(error, null, 2));
  
  // Map common errors to user-friendly messages
  if (error.message?.includes('Invalid login credentials')) {
    return new Error('Invalid email or password. Please try again.');
  } else if (error.message?.includes('Email not confirmed')) {
    return new Error('Please confirm your email address before signing in.');
  } else if (error.message?.includes('User already registered')) {
    return new Error('An account with this email already exists.');
  } else if (error.message?.includes('Password should be at least')) {
    return new Error('Password should be at least 6 characters long.');
  } else if (error.message?.includes('Network request failed')) {
    return new Error('Network error. Please check your internet connection and try again.');
  }
  
  return error.message ? error : new Error(fallbackMessage);
};

/**
 * Sign up a new user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {object} userData - User's additional data
 * @param {string} userData.name - User's full name
 * @param {string} userData.phoneNumber - User's phone number
 * @returns {Promise<object>} - The created user object
 */
export const signUp = async (email, password, userData) => {
  try {
    console.log("signUp called with email:", email);
    console.log("User data:", JSON.stringify(userData, null, 2));
    
    // Create user in Supabase Auth with user metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: null, // Disable email confirmation
      },
    });
    
    if (error) {
      console.error("Signup error:", error);
      throw error;
    }
    
    console.log("Auth signup successful. User object:", data?.user ? JSON.stringify({
      id: data.user.id,
      email: data.user.email,
      hasSession: !!data.session,
    }, null, 2) : "No user returned");
    
    // Create/update user profile in the database
    if (data.user) {
      try {
        await ensureUserProfile(data.user.id, {
          name: userData.name,
          email,
          phoneNumber: userData.phoneNumber || null,
        });
      } catch (profileError) {
        console.error('Error ensuring user profile:', profileError.message);
        // Continue anyway since the auth record was created
      }
    }
    
    // Don't auto sign-in after signup, allow onboarding flow to complete first
    if (data.session) {
      // Sign out automatically to force the onboarding flow
      await supabase.auth.signOut();
      console.log('Signed out to allow onboarding flow');
    }
    
    // Final validation of user object before returning
    if (!data.user || !data.user.id) {
      console.error("Invalid user object returned from signup:", data);
      throw new Error("Failed to create user properly");
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
  try {
    // Format phone number to ensure consistency
    let phoneNumber = null;
    if (userData.phoneNumber) {
      // Remove all non-numeric characters for consistent storage
      phoneNumber = userData.phoneNumber.replace(/\D/g, '');
      console.log(`Formatted phone number: ${phoneNumber}`);
    }

    console.log(`Creating/updating user profile with ID: ${userId}`);
    console.log('User data for profile:', JSON.stringify(userData, null, 2));
    
    // Ensure name is not empty
    const name = userData.name?.trim() || (userData.email ? userData.email.split('@')[0] : 'User');
    
    // Create user profile with data mapped to the correct column names in the database
    const { data, error } = await supabase
      .from('users')
      .upsert({
        id: userId,
        name: name, 
        email: userData.email,
        avatar_url: null,
        calendar: JSON.stringify([]),
        phone_number: phoneNumber,
        resume: null,
        tags: JSON.stringify([])
      }, { onConflict: 'id' });
    
    if (error) {
      console.error('Error in ensureUserProfile:', error);
      throw error;
    }
    
    // Verify the profile was created successfully
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('id, name, email, phone_number, tags, resume')
      .eq('id', userId)
      .single();
      
    if (verifyError) {
      console.error('Error verifying user profile creation:', verifyError);
    } else {
      console.log('Verified user profile:', JSON.stringify(verifyData, null, 2));
    }
    
    console.log(`User profile successfully created/updated.`);
    return data;
  } catch (error) {
    console.error('Error in ensureUserProfile:', error);
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
    throw handleError(error, 'Failed to sign out. Please try again.');
  }
};

/**
 * Checks if a phone number has already been invited
 * @param {string} phoneNumber - The phone number to check
 * @returns {Promise<boolean>} - Whether the phone number has been invited
 */
export const checkInvitationStatus = async (phoneNumber) => {
  try {
    // Standardize phone number by removing non-digit characters
    const standardizedNumber = phoneNumber.replace(/\D/g, '');
    
    const { data, error } = await supabase
      .from('invitations')
      .select('id')
      .eq('invited_phone', standardizedNumber)
      .limit(1);
    
    if (error) {
      console.error('Error checking invitation status:', error);
      throw new Error('Failed to check invitation status');
    }
    
    return data && data.length > 0;
  } catch (error) {
    console.error('Error in checkInvitationStatus:', error);
    throw error;
  }
};

/**
 * Sends an invitation to a contact
 * @param {string} name - The name of the contact
 * @param {string} phoneNumber - The phone number of the contact
 * @param {string} message - Optional message to include with the invitation
 * @returns {Promise<Object>} - Result of the invitation
 */
export const sendInvitation = async (name, phoneNumber, message = '') => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Error getting current user:', userError);
      throw new Error('You must be logged in to send invitations');
    }
    
    // Standardize phone number by removing non-digit characters
    const standardizedNumber = phoneNumber.replace(/\D/g, '');
    
    // Check if already invited
    const isAlreadyInvited = await checkInvitationStatus(standardizedNumber);
    
    if (isAlreadyInvited) {
      return { 
        success: false, 
        already_invited: true,
        message: `${name} has already been invited` 
      };
    }
    
    // Create invitation record
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        inviter_id: user.id,
        invited_name: name,
        invited_phone: standardizedNumber,
        message: message,
        status: 'sent'
      })
      .select();
    
    if (error) {
      console.error('Error creating invitation:', error);
      throw new Error('Failed to send invitation');
    }
    
    // TODO: In production, you would integrate with SMS service to send actual SMS invitation
    // For now, we'll just record the invitation in the database
    
    return { 
      success: true, 
      invitation: data[0],
      message: `Invitation sent to ${name}`
    };
  } catch (error) {
    console.error('Error in sendInvitation:', error);
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
    throw handleError(error, 'Failed to get user profile. Please try again.');
  }
}; 