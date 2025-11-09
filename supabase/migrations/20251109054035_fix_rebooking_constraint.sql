-- Fix rebooking issue: Allow cancelled slots to be rebooked
-- Remove the unique constraint on slot_id that prevents rebooking

-- Drop the existing unique constraint
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_slot_id_key;

-- Add a partial unique index - only enforce uniqueness for confirmed appointments
-- This allows the same slot to have multiple appointment records if they're cancelled
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_id_confirmed_unique 
ON appointments(slot_id) 
WHERE status = 'confirmed';

-- Add comment for documentation
COMMENT ON INDEX appointments_slot_id_confirmed_unique IS 
'Ensures each slot can only have one confirmed appointment, but allows cancelled/completed appointments to exist for history';
