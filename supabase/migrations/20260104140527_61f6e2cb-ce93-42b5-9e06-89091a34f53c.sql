-- Create discount history table to track all discounts given by admin
CREATE TABLE public.discount_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  booker_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id),
  original_amount NUMERIC NOT NULL,
  discounted_amount NUMERIC NOT NULL,
  discount_value NUMERIC NOT NULL,
  given_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add total discounts column to booker_financials
ALTER TABLE public.booker_financials 
ADD COLUMN total_discounts_given NUMERIC DEFAULT 0;

-- Enable RLS
ALTER TABLE public.discount_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for discount_history
CREATE POLICY "Admins can manage discount history"
ON public.discount_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all discount history"
ON public.discount_history
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Bookers can view their own discount history"
ON public.discount_history
FOR SELECT
USING (auth.uid() = booker_id);