
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- API Keys table
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default Key',
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own api_keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api_keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api_keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api_keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- API Usage table
CREATE TABLE public.api_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL DEFAULT '/generate-pdf',
  status TEXT NOT NULL DEFAULT 'success',
  document_count INTEGER NOT NULL DEFAULT 0,
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  bytes_processed BIGINT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own api_usage" ON public.api_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert api_usage" ON public.api_usage FOR INSERT WITH CHECK (true);
CREATE INDEX idx_api_usage_key_id ON public.api_usage(api_key_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at);

-- Generated Documents table
CREATE TABLE public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT,
  language TEXT,
  page_size TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own documents" ON public.generated_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.generated_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_generated_docs_user ON public.generated_documents(user_id);
