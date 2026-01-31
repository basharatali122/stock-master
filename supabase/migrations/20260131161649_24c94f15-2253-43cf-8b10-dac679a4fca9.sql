-- Create payment_history table to track all payment transactions
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  booker_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage payment history"
  ON public.payment_history
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all payment history"
  ON public.payment_history
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Bookers can view their payment history"
  ON public.payment_history
  FOR SELECT
  USING (auth.uid() = booker_id);

-- Enable realtime for payment history
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_history;

-- Create index for faster lookups
CREATE INDEX idx_payment_history_order_id ON public.payment_history(order_id);
CREATE INDEX idx_payment_history_shop_id ON public.payment_history(shop_id);
CREATE INDEX idx_payment_history_paid_at ON public.payment_history(paid_at DESC);