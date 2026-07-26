-- ==========================================
-- FIX INFINITE RECURSION IN RLS POLICIES
-- ==========================================

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. GROUPS POLICIES
DROP POLICY IF EXISTS "Users can view groups they're members of" ON public.groups;
DROP POLICY IF EXISTS "Anyone can view all groups" ON public.groups;
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;

CREATE POLICY "Anyone can view all groups" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 3. GROUP MEMBERS POLICIES (Fix infinite recursion here!)
DROP POLICY IF EXISTS "Users can view members of their groups" ON public.group_members;
DROP POLICY IF EXISTS "Anyone can view group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can join groups" ON public.group_members;
DROP POLICY IF EXISTS "Users can join any group" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON public.group_members;

CREATE POLICY "Anyone can view group members" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING (auth.uid() = user_id);

-- 4. ROUNDS POLICIES
DROP POLICY IF EXISTS "Users can view rounds in their groups" ON public.rounds;
DROP POLICY IF EXISTS "Users can view rounds" ON public.rounds;
DROP POLICY IF EXISTS "Users can insert own rounds" ON public.rounds;
DROP POLICY IF EXISTS "Users can update own rounds" ON public.rounds;

CREATE POLICY "Anyone can view rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Users can insert own rounds" ON public.rounds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rounds" ON public.rounds FOR UPDATE USING (auth.uid() = user_id);

-- 5. MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can view messages in their groups" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their groups" ON public.messages;

CREATE POLICY "Anyone can view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
