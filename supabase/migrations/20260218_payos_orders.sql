-- PayOS Payment Integration: Orders table + Profile updates
-- Run this in Supabase Dashboard → SQL Editor

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. Orders table
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  order_code BIGINT UNIQUE NOT NULL,         -- PayOS requires integer orderCode
  phone_number TEXT NOT NULL,
  product_type TEXT NOT NULL,                 -- 'premium_monthly', 'premium_yearly', 'credits_50', etc.
  amount_vnd INTEGER NOT NULL,
  payment_provider TEXT DEFAULT 'payos',      -- 'payos' | 'lemonsqueezy'
  status TEXT DEFAULT 'pending',             -- 'pending' | 'paid' | 'expired' | 'cancelled'
  payos_payment_link_id TEXT,                -- PayOS paymentLinkId
  payos_checkout_url TEXT,                   -- PayOS checkout URL
  payos_reference TEXT,                      -- Bank transaction reference
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only see their own orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own orders" ON orders;
CREATE POLICY "Users can insert own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. Update profiles table
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMPTZ;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. Function to expire old orders (run via cron or manual)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION expire_pending_orders()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE orders
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
