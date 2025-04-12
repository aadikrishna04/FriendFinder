# FriendBook

A social app that helps friends find each other, see each other's availability, and schedule meetings.

## Features

- Authentication (sign up, sign in)
- Access to Google Calendar and Contacts
- Location sharing with friends
- View friends' availability
- Send meeting requests
- Calendar integration

## Technologies Used

- Expo
- React Native
- Supabase (Authentication and Database)
- Tailwind CSS (via NativeWind)
- React Navigation

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Create a `.env` file in the root directory of the project
2. Add the following environment variables:

```
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Replace the values with your actual Supabase credentials.

### 3. Configure Supabase

1. Create a Supabase account and project at [https://supabase.com](https://supabase.com)
2. Get your Supabase URL and anon key from your project settings (Settings > API)
3. Add them to your `.env` file as described above

### 4. Set Up Database Tables

Create the following table in your Supabase database:

#### `users` Table

| Column     | Type   | Description             |
|------------|--------|-------------------------|
| id         | UUID   | PK, from Supabase auth  |
| name       | TEXT   | Full name               |
| email      | TEXT   | Unique                  |
| avatar_url | TEXT   | Profile picture URL     |
| calendar   | JSONB  | Mocked time blocks      |

You can create this table using the Supabase dashboard or with the following SQL:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  calendar JSONB
);

-- Create a policy to enable row level security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Users can view their own data" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Set up public profiles functionality (if needed)
CREATE POLICY "Public profiles are viewable by everyone" 
  ON users FOR SELECT 
  USING (true);
```

### 5. Run the App

```bash
npm start
```

Then scan the QR code with the Expo Go app on your device, or run on a simulator.

## Additional Supabase Setup

### Enable Email Authentication

1. In your Supabase dashboard, go to Authentication > Providers
2. Ensure Email provider is enabled
3. Configure any email templates if desired

### Set Up Database Triggers (Optional)

You may want to set up a trigger to automatically create a user profile when a new user signs up:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, calendar)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, null, '[]');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

This will ensure that a user record is created automatically in the `users` table when a new user signs up. 