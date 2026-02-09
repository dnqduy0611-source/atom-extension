# Phase 0: External Setup - Detailed Specification

**Version:** 1.0  
**Date:** 2026-02-09  
**Status:** Ready for Execution  
**Parent Spec:** [auth_infrastructure_spec.md](file:///d:/Amo/ATOM_Extension_V2.8_public/ideas/monetization/auth_infrastructure_spec.md)  
**Estimated Time:** 2-4 hours

---

## Overview

This phase configures all external services (Supabase, Google Cloud) before any code is written. By the end of this phase, you will have:
- A Supabase project with database schema
- Google OAuth configured
- All credentials needed for Phase 1

---

## Prerequisites

Before starting, ensure you have:
- [ ] Google account (for Supabase login and Google Cloud Console)
- [ ] AmoNexus extension loaded in Chrome (to get Extension ID)
- [ ] Basic understanding of OAuth flow

---

## Step-by-Step Instructions

### Step 1: Get Extension ID (5 min)

> [!IMPORTANT]
> You need the Extension ID before configuring OAuth redirect URIs.

1. Open Chrome → Navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked** → Select `ATOM_Extension_V2.8_public` folder
4. Copy the **Extension ID** (looks like `abcdefghijklmnopqrstuvwxyz123456`)

**Save this value:**
```
EXTENSION_ID = ________________________________
```

---

### Step 2: Create Supabase Project (10 min)

1. Go to [supabase.com](https://supabase.com) → **Sign In** (use Google)
2. Click **New Project**
3. Fill in:
   - **Name:** `amonexus-prod` (or `amonexus-dev` for development)
   - **Database Password:** Generate a strong password → **SAVE IT**
   - **Region:** Choose closest to your users (e.g., `Southeast Asia (Singapore)`)
4. Click **Create new project** → Wait 2-3 minutes for setup

**Save these values (from Project Settings → API):**
```
SUPABASE_URL       = https://____________.supabase.co
SUPABASE_ANON_KEY  = eyJhbGciOiJI... (long JWT token)
```

---

### Step 3: Create Database Schema (15 min)

1. In Supabase Dashboard → **SQL Editor** (left sidebar)
2. Click **New query**
3. Paste the following SQL:

```sql
-- =============================================
-- AMONEXUS AUTH INFRASTRUCTURE - DATABASE SCHEMA
-- Phase 0: Initial Setup
-- =============================================

-- 1. Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  
  -- Subscription fields (for future payment integration)
  is_pro BOOLEAN DEFAULT false,
  plan_variant_id TEXT,
  subscription_status TEXT DEFAULT 'free' 
    CHECK (subscription_status IN ('free', 'active', 'trialing', 'cancelled', 'past_due', 'expired')),
  subscription_end_date TIMESTAMPTZ,
  lemon_squeezy_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  
  -- Session management
  active_sessions INTEGER DEFAULT 1,
  remember_me BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can only read their own profile
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Auto-create profile on user signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. Updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

4. Click **Run** (or press `Ctrl+Enter`)
5. Expected output: `Success. No rows returned`

**Verification:**
- Go to **Table Editor** (left sidebar)
- You should see `profiles` table listed
- Click on it to verify columns exist

---

### Step 4: Create Google Cloud Project (10 min)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click project dropdown (top-left) → **New Project**
3. Fill in:
   - **Project name:** `AmoNexus Extension`
   - **Organization:** Leave as-is
4. Click **Create** → Wait for project creation
5. Make sure the new project is selected (check top-left dropdown)

---

### Step 5: Configure OAuth Consent Screen (15 min)

1. In Google Cloud Console → Search bar → Type **"OAuth consent screen"**
2. Select **External** (for public users) → Click **Create**
3. Fill in **App information:**

| Field | Value |
|-------|-------|
| App name | `AmoNexus` |
| User support email | Your email |
| App logo | (Optional) Upload AmoNexus icon |
| App domain | (Leave blank for now) |
| Developer contact | Your email |

4. Click **Save and Continue**

5. **Scopes page:** Click **Add or Remove Scopes**
   - Search and select:
     - `openid`
     - `email`  
     - `profile`
   - Click **Update** → **Save and Continue**

6. **Test users page:** (Development only)
   - Click **Add Users**
   - Add your Google email(s) for testing
   - Click **Save and Continue**

7. Click **Back to Dashboard**

> [!NOTE]
> For production, you'll need to submit for verification (can take 2-4 weeks).
> During development, only test users can sign in.

---

### Step 6: Create OAuth 2.0 Client ID (10 min)

1. In Google Cloud Console → **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Fill in:

| Field | Value |
|-------|-------|
| Name | `AmoNexus Extension Auth` |
| Authorized JavaScript origins | (Leave blank) |
| Authorized redirect URIs | Add these 2 URIs: |

**Redirect URIs to add:**
```
https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
https://YOUR_EXTENSION_ID.chromiumapp.org/
```

Replace with your actual values:
- `YOUR_SUPABASE_PROJECT_ID` = From Step 2 (the part before `.supabase.co`)
- `YOUR_EXTENSION_ID` = From Step 1

5. Click **Create**
6. A popup shows your credentials:

**Save these values:**
```
GOOGLE_CLIENT_ID     = ____________.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = GOCSPX-____________
```

---

### Step 7: Enable Google Provider in Supabase (5 min)

1. Go to Supabase Dashboard → **Authentication** (left sidebar)
2. Click **Providers** tab
3. Find **Google** → Click to expand
4. Toggle **Enable Sign in with Google** = ON
5. Fill in:

| Field | Value |
|-------|-------|
| Client ID | `GOOGLE_CLIENT_ID` from Step 6 |
| Client Secret | `GOOGLE_CLIENT_SECRET` from Step 6 |

6. Click **Save**

**Verification:**
- Google provider should show a green checkmark

---

### Step 8: Test OAuth Flow (Optional but Recommended) (5 min)

1. Go to Supabase Dashboard → **Authentication** → **Users** tab
2. Note that the users list is empty
3. In a new browser tab, go to:
   ```
   https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/authorize?provider=google&redirect_to=https://YOUR_SUPABASE_PROJECT_ID.supabase.co
   ```
4. You should see Google sign-in popup
5. Sign in with a test user email
6. After redirect, go back to Supabase → **Authentication** → **Users**
7. You should see the test user listed

> [!TIP]
> If you get an error, double-check redirect URIs in both Google Cloud Console and Supabase.

---

## Deliverables Checklist

After completing Phase 0, you should have:

```
✅ EXTENSION_ID         = ________________________________

✅ SUPABASE_URL         = https://____________.supabase.co
✅ SUPABASE_ANON_KEY    = eyJhbGciOiJI...

✅ GOOGLE_CLIENT_ID     = ____________.apps.googleusercontent.com
✅ GOOGLE_CLIENT_SECRET = GOCSPX-____________
```

**Database:**
- [ ] `profiles` table exists
- [ ] RLS policies enabled
- [ ] `on_auth_user_created` trigger exists

**Google Cloud:**
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 Client ID created with correct redirect URIs

**Supabase:**
- [ ] Google provider enabled with correct credentials

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
- **Cause:** Redirect URI in Google Cloud Console doesn't match exactly
- **Fix:** Check for trailing slashes, typos, http vs https

### Error: "access_denied" 
- **Cause:** User not added as test user (during development)
- **Fix:** Add email to OAuth consent screen → Test users

### Error: "invalid_client"
- **Cause:** Wrong Client ID or Secret
- **Fix:** Re-copy credentials from Google Cloud Console

### Supabase SQL Error: "relation already exists"
- **Cause:** Table already created from previous attempt
- **Fix:** Run `DROP TABLE IF EXISTS profiles CASCADE;` first, then re-run schema

---

## Next Steps

Once all checkboxes above are verified, proceed to:
→ **Phase 1: Core Services** - Create `supabase_client.js`, `auth_service.js`, `cache_service.js`

---

**Document History:**
- v1.0 (2026-02-09): Initial spec created

