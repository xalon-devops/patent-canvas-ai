-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create subscriptions table for paid users
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    plan TEXT NOT NULL DEFAULT 'premium', -- 'free', 'premium', 'enterprise'
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is paid
CREATE OR REPLACE FUNCTION public.is_paid_user(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE user_id = _user_id
      AND status = 'active'
      AND plan != 'free'
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscription" 
ON public.subscriptions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all subscriptions" 
ON public.subscriptions 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Insert nash@kronoscapital.us into users table (using the user_id from auth logs)
INSERT INTO public.users (id, email, created_at)
VALUES ('0290fb0f-0089-4f3d-8507-08de9e5f7b86', 'nash@kronoscapital.us', now())
ON CONFLICT (id) DO NOTHING;

-- Make nash@kronoscapital.us an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('0290fb0f-0089-4f3d-8507-08de9e5f7b86', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Make nash@kronoscapital.us a paid user
INSERT INTO public.subscriptions (user_id, status, plan, current_period_start, current_period_end)
VALUES (
    '0290fb0f-0089-4f3d-8507-08de9e5f7b86', 
    'active', 
    'premium',
    now(),
    now() + INTERVAL '1 year'
)
ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    plan = 'premium',
    current_period_start = now(),
    current_period_end = now() + INTERVAL '1 year',
    updated_at = now();