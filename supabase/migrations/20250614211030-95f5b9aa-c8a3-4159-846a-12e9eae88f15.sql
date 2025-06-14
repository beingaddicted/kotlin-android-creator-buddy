
-- Create a table to track organization subscriptions
CREATE TABLE public.organization_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  google_play_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive', -- 'active', 'inactive', 'past_due', 'canceled'
  member_count INTEGER NOT NULL DEFAULT 0,
  monthly_cost_cents INTEGER NOT NULL DEFAULT 0, -- 10 cents per member
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a table to track billing history
CREATE TABLE public.billing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  member_count INTEGER NOT NULL,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
  payment_method TEXT NOT NULL, -- 'stripe', 'google_play'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_history ENABLE ROW LEVEL SECURITY;

-- Create policies for organization subscriptions
CREATE POLICY "Organization owners can view their subscriptions" 
  ON public.organization_subscriptions 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update their subscriptions" 
  ON public.organization_subscriptions 
  FOR UPDATE 
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert subscriptions" 
  ON public.organization_subscriptions 
  FOR INSERT 
  WITH CHECK (true);

-- Create policies for billing history
CREATE POLICY "Organization owners can view their billing history" 
  ON public.billing_history 
  FOR SELECT 
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert billing records" 
  ON public.billing_history 
  FOR INSERT 
  WITH CHECK (true);

-- Create a function to automatically update subscription costs when member count changes
CREATE OR REPLACE FUNCTION update_subscription_cost()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the subscription cost based on current member count
  UPDATE public.organization_subscriptions 
  SET 
    member_count = (
      SELECT COUNT(*) 
      FROM public.organization_members 
      WHERE organization_id = NEW.organization_id 
      AND status = 'active'
    ),
    monthly_cost_cents = (
      SELECT COUNT(*) * 10 
      FROM public.organization_members 
      WHERE organization_id = NEW.organization_id 
      AND status = 'active'
    ),
    updated_at = now()
  WHERE organization_id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update costs when members are added/removed
CREATE TRIGGER update_subscription_cost_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_cost();
