import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: {
    id: string;
    start_time: string;
    end_time: string;
    faculty_id: string;
  } | null;
  facultyName: string;
  studentId: string;
  onSuccess: () => void;
}

export const BookingModal = ({ open, onOpenChange, slot, facultyName, studentId, onSuccess }: BookingModalProps) => {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBook = async () => {
    if (!slot) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .insert({
          slot_id: slot.id,
          faculty_id: slot.faculty_id,
          student_id: studentId,
          student_notes: notes || null,
          status: "confirmed",
        });

      if (error) throw error;

      toast.success("Appointment booked successfully!");
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      if (error.message.includes("already booked")) {
        toast.error("This slot was just booked by someone else. Please select another slot.");
      } else {
        toast.error(error.message || "Failed to book appointment");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!slot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>
            Confirm your 15-minute consultation with {facultyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">Appointment Details</p>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(slot.start_time), "PPP 'at' p")}
            </p>
            <p className="text-sm text-muted-foreground">
              Duration: 15 minutes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any specific topics or questions you'd like to discuss..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBook} disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};