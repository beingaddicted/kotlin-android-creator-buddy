
-- First, let's safely add policies only if they don't exist
-- Check and add missing policies for organizations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Users can view organizations they created or are members of'
    ) THEN
        CREATE POLICY "Users can view organizations they created or are members of" 
          ON public.organizations 
          FOR SELECT 
          USING (
            created_by = auth.uid() OR 
            id IN (
              SELECT organization_id FROM public.organization_members 
              WHERE user_id = auth.uid() AND status = 'active'
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Users can create their own organizations'
    ) THEN
        CREATE POLICY "Users can create their own organizations" 
          ON public.organizations 
          FOR INSERT 
          WITH CHECK (created_by = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Organization creators can update their organizations'
    ) THEN
        CREATE POLICY "Organization creators can update their organizations" 
          ON public.organizations 
          FOR UPDATE 
          USING (created_by = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organizations' 
        AND policyname = 'Organization creators can delete their organizations'
    ) THEN
        CREATE POLICY "Organization creators can delete their organizations" 
          ON public.organizations 
          FOR DELETE 
          USING (created_by = auth.uid());
    END IF;
END $$;

-- Check and add missing policies for organization_members table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organization_members' 
        AND policyname = 'Users can view members of organizations they belong to'
    ) THEN
        CREATE POLICY "Users can view members of organizations they belong to" 
          ON public.organization_members 
          FOR SELECT 
          USING (
            organization_id IN (
              SELECT id FROM public.organizations WHERE created_by = auth.uid()
            ) OR 
            user_id = auth.uid()
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organization_members' 
        AND policyname = 'Organization owners can add members'
    ) THEN
        CREATE POLICY "Organization owners can add members" 
          ON public.organization_members 
          FOR INSERT 
          WITH CHECK (
            organization_id IN (
              SELECT id FROM public.organizations WHERE created_by = auth.uid()
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organization_members' 
        AND policyname = 'Organization owners can update member status'
    ) THEN
        CREATE POLICY "Organization owners can update member status" 
          ON public.organization_members 
          FOR UPDATE 
          USING (
            organization_id IN (
              SELECT id FROM public.organizations WHERE created_by = auth.uid()
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'organization_members' 
        AND policyname = 'Organization owners and members can remove themselves'
    ) THEN
        CREATE POLICY "Organization owners and members can remove themselves" 
          ON public.organization_members 
          FOR DELETE 
          USING (
            organization_id IN (
              SELECT id FROM public.organizations WHERE created_by = auth.uid()
            ) OR 
            user_id = auth.uid()
          );
    END IF;
END $$;

-- Check and add missing policies for locations table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'locations' 
        AND policyname = 'Users can view their own locations'
    ) THEN
        CREATE POLICY "Users can view their own locations" 
          ON public.locations 
          FOR SELECT 
          USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'locations' 
        AND policyname = 'Users can insert their own locations'
    ) THEN
        CREATE POLICY "Users can insert their own locations" 
          ON public.locations 
          FOR INSERT 
          WITH CHECK (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'locations' 
        AND policyname = 'Users can update their own locations'
    ) THEN
        CREATE POLICY "Users can update their own locations" 
          ON public.locations 
          FOR UPDATE 
          USING (user_id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'locations' 
        AND policyname = 'Users can delete their own locations'
    ) THEN
        CREATE POLICY "Users can delete their own locations" 
          ON public.locations 
          FOR DELETE 
          USING (user_id = auth.uid());
    END IF;
END $$;

-- Check and add missing policies for profiles table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can view their own profile'
    ) THEN
        CREATE POLICY "Users can view their own profile" 
          ON public.profiles 
          FOR SELECT 
          USING (id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can insert their own profile'
    ) THEN
        CREATE POLICY "Users can insert their own profile" 
          ON public.profiles 
          FOR INSERT 
          WITH CHECK (id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" 
          ON public.profiles 
          FOR UPDATE 
          USING (id = auth.uid());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Users can delete their own profile'
    ) THEN
        CREATE POLICY "Users can delete their own profile" 
          ON public.profiles 
          FOR DELETE 
          USING (id = auth.uid());
    END IF;
END $$;

-- Enable RLS on all tables (this is safe to run multiple times)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
