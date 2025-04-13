#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Applying database fixes for FriendFinder...${NC}"

# Ensure SUPABASE_URL and SUPABASE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set.${NC}"
  echo "You can get these from your Supabase dashboard."
  echo "Try running: export SUPABASE_URL=<your-url> SUPABASE_ANON_KEY=<your-key>"
  exit 1
fi

# Load .env file if it exists
if [ -f ../.env ]; then
  echo -e "${GREEN}Loading environment variables from .env file${NC}"
  export $(grep -v '^#' ../.env | xargs)
fi

# Apply fix_user_trigger.sql
echo -e "${BLUE}Applying user trigger fixes...${NC}"
psql "$SUPABASE_URL" -f ./sql/fix_user_trigger.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ User trigger fixes applied successfully${NC}"
else
  echo -e "${RED}✗ Failed to apply user trigger fixes${NC}"
  exit 1
fi

# Apply RLS fixes
echo -e "${BLUE}Applying RLS policy fixes...${NC}"
psql "$SUPABASE_URL" -f ./sql/supabase_rls_fix.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ RLS policy fixes applied successfully${NC}"
else
  echo -e "${RED}✗ Failed to apply RLS policy fixes${NC}"
  exit 1
fi

echo -e "${GREEN}All database fixes applied successfully!${NC}"
echo -e "${BLUE}The signup process should now correctly save all user fields.${NC}" 