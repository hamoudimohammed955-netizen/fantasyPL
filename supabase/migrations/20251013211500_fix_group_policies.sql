-- Drop existing policies
DROP POLICY IF EXISTS "Users can view groups they're members of" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;

-- Create updated policies for groups
CREATE POLICY "Anyone can view all groups"
  ON public.groups FOR SELECT
  USING (true);

CREATE POLICY "Users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Create updated policies for group members
CREATE POLICY "Anyone can view group members"
  ON public.group_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join any group"
  ON public.group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger to auto-generate group code on creation
CREATE OR REPLACE FUNCTION public.before_group_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code = generate_group_code();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_group_insert
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.before_group_insert();