#!/bin/bash

echo "==================================="
echo "WEBHOOK SECRET GENERATOR"
echo "==================================="
echo ""
echo "Choose a method to generate your webhook secret:"
echo ""

# Method 1: Using OpenSSL (most secure)
echo "Method 1 - OpenSSL (Recommended):"
echo "----------------------------------"
if command -v openssl &> /dev/null; then
    SECRET_1=$(openssl rand -base64 32)
    echo "SECRET: $SECRET_1"
else
    echo "OpenSSL not installed"
fi
echo ""

# Method 2: Using Node.js crypto
echo "Method 2 - Node.js Crypto:"
echo "--------------------------"
if command -v node &> /dev/null; then
    SECRET_2=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "SECRET: $SECRET_2"
else
    echo "Node.js not installed"
fi
echo ""

# Method 3: Using /dev/urandom
echo "Method 3 - Linux Random:"
echo "------------------------"
if [ -r /dev/urandom ]; then
    SECRET_3=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
    echo "SECRET: $SECRET_3"
else
    echo "/dev/urandom not available"
fi
echo ""

# Method 4: Using date and random
echo "Method 4 - Simple Random (Less Secure):"
echo "----------------------------------------"
SECRET_4=$(date +%s%N | sha256sum | base64 | head -c 32)
echo "SECRET: $SECRET_4"
echo ""

echo "==================================="
echo "HOW TO USE YOUR WEBHOOK SECRET:"
echo "==================================="
echo ""
echo "1. Copy one of the secrets above"
echo ""
echo "2. Add to Render environment variables:"
echo "   - Go to your InventiBot service in Render"
echo "   - Navigate to Environment tab"
echo "   - Add: WEBHOOK_SECRET = [your-chosen-secret]"
echo ""
echo "3. Configure in Supabase (SQL Editor):"
echo "   ALTER DATABASE postgres SET app.webhook_secret = '[your-chosen-secret]';"
echo ""
echo "4. Or for Edge Functions (Supabase CLI):"
echo "   supabase secrets set WEBHOOK_SECRET=[your-chosen-secret]"
echo ""
echo "==================================="
echo "IMPORTANT NOTES:"
echo "==================================="
echo "- Use the SAME secret in all three places"
echo "- Keep it secret - don't commit to git!"
echo "- Make it at least 32 characters long"
echo "- Use only alphanumeric and basic symbols"
echo ""