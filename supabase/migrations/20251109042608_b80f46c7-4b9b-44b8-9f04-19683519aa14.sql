-- Fix security warnings: Add search_path to existing functions

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