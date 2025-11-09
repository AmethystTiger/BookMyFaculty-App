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

  // This function now handles both database notifications and email notifications
  const sendNotificationsAndEmails = async (newAppointmentId: string, studentName: string, studentEmail: string, facultyEmail: string) => {
    if (!slot) return;

    const appointmentTime = format(new Date(slot.start_time), "PPP 'at' p");

    try {
      // 1. Create In-App Notification for Student
      await supabase
        .from("notifications")
        .insert({
          user_id: studentId,
          title: "Appointment Confirmed!",
          message: `Your booking with ${facultyName} for ${appointmentTime} is confirmed.`,
          type: "booking",
          appointment_id: newAppointmentId,
        });

      // 2. Create In-App Notification for Faculty
      await supabase
        .from("notifications")
        .insert({
          user_id: slot.faculty_id,
          title: "New Booking",
          message: `You have a new appointment with ${studentName} on ${appointmentTime}.`,
          type: "booking",
          appointment_id: newAppointmentId,
        });

      // 3. Send Email to Student
      const studentSubject = `Appointment Confirmed: ${facultyName}`;
      const studentHtml = `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>Appointment Confirmed!</h2>
          <p>Hi ${studentName},</p>
          <p>Your 15-minute consultation with <strong>${facultyName}</strong> is confirmed.</p>
          <p><strong>Time:</strong> ${appointmentTime}</p>
          <p><strong>Notes:</strong> ${notes || "None"}</p>
          <p>Thank you!</p>
        </div>
      `;
      
      await supabase.functions.invoke('send-notification-email', { 
        body: { to: studentEmail, subject: studentSubject, html: studentHtml } 
      });

      // 4. Send Email to Faculty
      const facultySubject = `New Appointment Booked: ${studentName}`;
      const facultyHtml = `
        <div style="font-family: sans-serif; line-height: 1.6;">
          <h2>New Appointment Booked</h2>
          <p>A new consultation has been booked with you.</p>
          <p><strong>Student:</strong> ${studentName} (${studentEmail})</p>
          <p><strong>Time:</strong> ${appointmentTime}</p>
          <p><strong>Student Notes:</strong> ${notes || "None"}</p>
        </div>
      `;

      await supabase.functions.invoke('send-notification-email', { 
        body: { to: facultyEmail, subject: facultySubject, html: facultyHtml } 
      });

    } catch (notificationError: any) {
      // Don't bother the user with a UI error, just log it to the console.
      // The booking was successful, which is the most important part.
      console.error("Failed to send notifications or emails:", notificationError);
      toast.warning("Booking successful, but failed to send notifications. Please check console.");
    }
  };

  const handleBook = async () => {
    if (!slot) return;
    setLoading(true);

    try {
      // Step 1: Get user details first (needed for notifications)
      const { data: studentData, error: studentError } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", studentId)
        .single();

      const { data: facultyData, error: facultyError } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", slot.faculty_id)
        .single();

      if (studentError || facultyError || !studentData || !facultyData) {
        throw new Error("Could not find user details to send emails.");
      }

      // Step 2: Create the appointment
      // We add .select("id") to get the ID of the new appointment
      const { data: newAppointment, error: insertError } = await supabase
        .from("appointments")
        .insert({
          slot_id: slot.id,
          faculty_id: slot.faculty_id,
          student_id: studentId,
          student_notes: notes || null,
          status: "confirmed",
        })
        .select("id")
        .single(); // Use .single() to get the inserted row back

      if (insertError) throw insertError;
      if (!newAppointment) throw new Error("Failed to create appointment.");


      // Step 3: Show immediate success toast
      toast.success("Appointment booked successfully! Sending notifications...");
      
      // Step 4: Send notifications/emails in the background (fire-and-forget)
      // We don't use 'await' here so the UI closes immediately.
      sendNotificationsAndEmails(
        newAppointment.id,
        studentData.full_name,
        studentData.email,
        facultyData.email
      ); 

      // Step 5: Reset UI
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