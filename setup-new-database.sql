-- ============================================================================
-- FACULTY BOOKING SYSTEM - COMPLETE DATABASE SETUP
-- Run this script in your Supabase SQL Editor to set up the entire database
-- ============================================================================

-- ============================================================================
-- PART 1: CORE SCHEMA & TABLES
-- ============================================================================

-- Create user role enum
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');

-- Create app_role enum (for secure role management)
CREATE TYPE app_role AS ENUM ('student', 'faculty', 'admin');

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_roles table (secure role management)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create faculty_profiles table (additional info for faculty)
CREATE TABLE faculty_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  chamber_location TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create availability_slots table
CREATE TABLE availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT fifteen_minute_slot CHECK (EXTRACT(EPOCH FROM (end_time - start_time)) = 900)
);

-- Create appointments table (WITHOUT strict slot_id unique constraint)
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  student_notes TEXT,
  faculty_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add partial unique index - only confirmed appointments must have unique slots
-- This allows rebooking of cancelled slots
CREATE UNIQUE INDEX appointments_slot_id_confirmed_unique 
ON appointments(slot_id) 
WHERE status = 'confirmed';

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('booking', 'cancellation', 'reminder', 'update')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PART 2: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_availability_faculty ON availability_slots(faculty_id);
CREATE INDEX idx_availability_time ON availability_slots(start_time, end_time);
CREATE INDEX idx_availability_booked ON availability_slots(is_booked);
CREATE INDEX idx_appointments_faculty ON appointments(faculty_id);
CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role"
  ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only admins can insert roles"
  ON user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
  ON user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
  ON user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Faculty profiles policies
CREATE POLICY "Anyone can view faculty profiles"
  ON faculty_profiles FOR SELECT
  USING (true);

CREATE POLICY "Faculty can update own profile"
  ON faculty_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Faculty can insert own profile"
  ON faculty_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Availability slots policies
CREATE POLICY "Anyone can view available slots"
  ON availability_slots FOR SELECT
  USING (true);

CREATE POLICY "Faculty can manage own slots"
  ON availability_slots FOR ALL
  USING (auth.uid() = faculty_id);

-- Appointments policies
CREATE POLICY "Students can view own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = student_id OR auth.uid() = faculty_id);

CREATE POLICY "Students can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students and faculty can update appointments"
  ON appointments FOR UPDATE
  USING (auth.uid() = student_id OR auth.uid() = faculty_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 4: FUNCTIONS & TRIGGERS
-- ============================================================================

-- Helper function to check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User')
  );
  
  -- Insert role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to prevent double booking
CREATE OR REPLACE FUNCTION public.check_slot_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if slot is already booked
  IF EXISTS (
    SELECT 1 FROM availability_slots
    WHERE id = NEW.slot_id AND is_booked = true
  ) THEN
    RAISE EXCEPTION 'This slot is already booked';
  END IF;
  
  -- Mark slot as booked
  UPDATE availability_slots
  SET is_booked = true, updated_at = NOW()
  WHERE id = NEW.slot_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for appointment booking
CREATE TRIGGER before_appointment_insert
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_slot_availability();

-- Function to handle appointment cancellation
CREATE OR REPLACE FUNCTION public.handle_appointment_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If appointment is cancelled, free up the slot
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE availability_slots
    SET is_booked = false, updated_at = NOW()
    WHERE id = NEW.slot_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for appointment cancellation
CREATE TRIGGER after_appointment_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_cancellation();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_faculty_profiles_updated_at
  BEFORE UPDATE ON faculty_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_availability_slots_updated_at
  BEFORE UPDATE ON availability_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- PART 5: REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for appointments, availability_slots, and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE availability_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- Your Faculty Booking System database is now ready!
-- Next steps:
-- 1. Go to Authentication > Providers in Supabase dashboard
-- 2. Enable Email provider
-- 3. Start using the application!
-- ============================================================================
