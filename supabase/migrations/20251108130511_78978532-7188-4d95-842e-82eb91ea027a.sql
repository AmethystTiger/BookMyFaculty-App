-- Create user role enum
CREATE TYPE user_role AS ENUM ('student', 'faculty', 'admin');

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

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

-- Enable RLS on faculty_profiles
ALTER TABLE faculty_profiles ENABLE ROW LEVEL SECURITY;

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

-- Create index for faster queries
CREATE INDEX idx_availability_faculty ON availability_slots(faculty_id);
CREATE INDEX idx_availability_time ON availability_slots(start_time, end_time);
CREATE INDEX idx_availability_booked ON availability_slots(is_booked);

-- Enable RLS on availability_slots
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Availability slots policies
CREATE POLICY "Anyone can view available slots"
  ON availability_slots FOR SELECT
  USING (true);

CREATE POLICY "Faculty can manage own slots"
  ON availability_slots FOR ALL
  USING (auth.uid() = faculty_id);

-- Create appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL UNIQUE REFERENCES availability_slots(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  student_notes TEXT,
  faculty_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for appointments
CREATE INDEX idx_appointments_faculty ON appointments(faculty_id);
CREATE INDEX idx_appointments_student ON appointments(student_id);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Enable RLS on appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

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

-- Create index for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to prevent double booking
CREATE OR REPLACE FUNCTION public.check_slot_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Create trigger for appointment booking
CREATE TRIGGER before_appointment_insert
  BEFORE INSERT ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_slot_availability();

-- Create function to handle appointment cancellation
CREATE OR REPLACE FUNCTION public.handle_appointment_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Create trigger for appointment cancellation
CREATE TRIGGER after_appointment_update
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_appointment_cancellation();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
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

-- Enable realtime for appointments and availability_slots
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE availability_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;