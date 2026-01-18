-- Create manual_credits table to track credits added by admin with order booker
CREATE TABLE public.manual_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  booker_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.manual_credits ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage manual credits"
ON public.manual_credits
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all manual credits"
ON public.manual_credits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Bookers can view their own manual credits"
ON public.manual_credits
FOR SELECT
USING (auth.uid() = booker_id);

-- Create trigger for updated_at
CREATE TRIGGER update_manual_credits_updated_at
BEFORE UPDATE ON public.manual_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();