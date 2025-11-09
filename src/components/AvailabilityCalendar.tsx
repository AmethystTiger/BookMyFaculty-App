import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format, addMinutes, startOfDay, isBefore } from "date-fns";
import { Trash2, Plus } from "lucide-react";

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
}

export const AvailabilityCalendar = ({ facultyId }: { facultyId: string }) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSlots();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('availability-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_slots',
          filter: `faculty_id=eq.${facultyId}`
        },
        () => fetchSlots()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, facultyId]);

  const fetchSlots = async () => {
    const startOfSelectedDay = startOfDay(selectedDate).toISOString();
    const endOfSelectedDay = addMinutes(startOfSelectedDay, 24 * 60).toISOString();

    const { data, error } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("faculty_id", facultyId)
      .gte("start_time", startOfSelectedDay)
      .lt("start_time", endOfSelectedDay)
      .order("start_time");

    if (error) {
      console.error("Error fetching slots:", error);
    } else {
      setSlots(data || []);
    }
  };

  const addSlot = async () => {
    if (!selectedTime) {
      toast.error("Please select a time");
      return;
    }

    setLoading(true);
    try {
      const [hours, minutes] = selectedTime.split(":");
      const startTime = new Date(selectedDate);
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      if (isBefore(startTime, new Date())) {
        toast.error("Cannot create slots in the past");
        setLoading(false);
        return;
      }

      const endTime = addMinutes(startTime, 15);

      const { error } = await supabase
        .from("availability_slots")
        .insert({
          faculty_id: facultyId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });

      if (error) throw error;

      toast.success("Time slot added successfully!");
      setSelectedTime("");
      fetchSlots();
    } catch (error: any) {
      toast.error(error.message || "Failed to add slot");
    } finally {
      setLoading(false);
    }
  };

  const deleteSlot = async (slotId: string, isBooked: boolean) => {
    if (isBooked) {
      toast.error("Cannot delete booked slots");
      return;
    }

    try {
      const { error } = await supabase
        .from("availability_slots")
        .delete()
        .eq("id", slotId);

      if (error) throw error;

      toast.success("Slot deleted successfully!");
      fetchSlots();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete slot");
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>Choose a date to manage your availability</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            disabled={(date) => isBefore(date, startOfDay(new Date()))}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Time Slots for {format(selectedDate, "PPP")}</CardTitle>
          <CardDescription>Add 15-minute consultation slots</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={addSlot} disabled={loading}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {slots.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No slots available</p>
            ) : (
              slots.map((slot) => (
                <div
                  key={slot.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    slot.is_booked ? "bg-muted" : "bg-card"
                  }`}
                >
                  <span className="text-sm">
                    {format(new Date(slot.start_time), "p")} - {format(new Date(slot.end_time), "p")}
                    {slot.is_booked && <span className="ml-2 text-xs text-muted-foreground">(Booked)</span>}
                  </span>
                  {!slot.is_booked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSlot(slot.id, slot.is_booked)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};