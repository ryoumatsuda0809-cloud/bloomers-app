
-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'user');
CREATE TYPE public.order_status AS ENUM ('draft', 'approved', 'delivered');
CREATE TYPE public.compliance_event AS ENUM ('arrival', 'waiting_start', 'loading_start', 'departure');

-- 2. Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  capital_amount BIGINT NOT NULL DEFAULT 0,
  employee_count INTEGER NOT NULL DEFAULT 0,
  is_regulated BOOLEAN GENERATED ALWAYS AS (capital_amount > 300000000 OR employee_count > 300) STORED,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);

-- 5. Transport Orders
CREATE TABLE public.transport_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_due_date DATE,
  status order_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Compliance Logs
CREATE TABLE public.compliance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.transport_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type compliance_event NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_check BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_logs ENABLE ROW LEVEL SECURITY;

-- 8. Security definer helper functions
CREATE OR REPLACE FUNCTION public.get_user_org_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_org(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND organization_id = _org_id
  );
$$;

-- 9. RLS Policies - Organizations
CREATE POLICY "Members can view their org"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_member_of_org(auth.uid(), id));

CREATE POLICY "Admins can insert orgs"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_role_in_org(auth.uid(), id, 'admin'));

CREATE POLICY "Admins can delete their org"
  ON public.organizations FOR DELETE TO authenticated
  USING (public.has_role_in_org(auth.uid(), id, 'admin'));

-- 10. RLS Policies - Profiles
CREATE POLICY "Users can view profiles in their org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id IS NULL AND user_id = auth.uid()
    OR public.is_member_of_org(auth.uid(), organization_id)
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- 11. RLS Policies - User Roles
CREATE POLICY "Members can view roles in their org"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "Admins can manage roles in their org"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can update roles in their org"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can delete roles in their org"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

-- 12. RLS Policies - Transport Orders
CREATE POLICY "Members can view orders in their org"
  ON public.transport_orders FOR SELECT TO authenticated
  USING (public.is_member_of_org(auth.uid(), organization_id));

CREATE POLICY "Admins can create orders"
  ON public.transport_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can update orders"
  ON public.transport_orders FOR UPDATE TO authenticated
  USING (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

CREATE POLICY "Admins can delete orders"
  ON public.transport_orders FOR DELETE TO authenticated
  USING (public.has_role_in_org(auth.uid(), organization_id, 'admin'));

-- 13. RLS Policies - Compliance Logs
CREATE POLICY "Members can view logs for their org orders"
  ON public.compliance_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_orders t
      WHERE t.id = order_id
      AND public.is_member_of_org(auth.uid(), t.organization_id)
    )
  );

CREATE POLICY "Drivers can create logs"
  ON public.compliance_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.transport_orders t
      WHERE t.id = order_id
      AND (
        public.has_role_in_org(auth.uid(), t.organization_id, 'driver')
        OR public.has_role_in_org(auth.uid(), t.organization_id, 'admin')
      )
    )
  );

CREATE POLICY "Admins can update logs"
  ON public.compliance_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_orders t
      WHERE t.id = order_id
      AND public.has_role_in_org(auth.uid(), t.organization_id, 'admin')
    )
  );

CREATE POLICY "Admins can delete logs"
  ON public.compliance_logs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transport_orders t
      WHERE t.id = order_id
      AND public.has_role_in_org(auth.uid(), t.organization_id, 'admin')
    )
  );

-- 14. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transport_orders_updated_at
  BEFORE UPDATE ON public.transport_orders FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 16. Indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_org_id ON public.profiles(organization_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_org_id ON public.user_roles(organization_id);
CREATE INDEX idx_transport_orders_org_id ON public.transport_orders(organization_id);
CREATE INDEX idx_transport_orders_status ON public.transport_orders(status);
CREATE INDEX idx_compliance_logs_order_id ON public.compliance_logs(order_id);
