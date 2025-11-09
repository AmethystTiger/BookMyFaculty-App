import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, LogOut, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchProfile();
      fetchAppointments();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('student-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `student_id=eq.${user.id}`
        },
        () => fetchAppointments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .single();

    setProfile(data);
  };

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        availability_slots(start_time, end_time),
        faculty:profiles!appointments_faculty_id_fkey(full_name, email),
        faculty_profile:faculty_profiles!appointments_faculty_id_fkey(department, chamber_location)
      `)
      .eq("student_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching appointments:", error);
    } else {
      setAppointments(data || []);
    }
    setLoadingData(false);
  };

  const cancelAppointment = async (appointmentId: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointmentId);

    if (error) {
      console.error("Error cancelling appointment:", error);
    } else {
      fetchAppointments();
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(
    (apt) => apt.status === "confirmed" && new Date(apt.availability_slots?.start_time) > new Date()
  );

  const pastAppointments = appointments.filter(
    (apt) => apt.status === "confirmed" && new Date(apt.availability_slots?.start_time) <= new Date()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Student Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name}!</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/faculty/search")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle>Search Faculty</CardTitle>
              </div>
              <CardDescription>Find and book appointments with faculty members</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                Browse Faculty
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Upcoming Appointments</CardTitle>
              </div>
              <CardDescription>You have {upcomingAppointments.length} upcoming consultations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Appointments</CardTitle>
            <CardDescription>View and manage your booked consultation slots</CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No appointments yet</p>
                <Button className="mt-4" onClick={() => navigate("/faculty/search")}>
                  Book Your First Appointment
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {upcomingAppointments.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Upcoming</h3>
                    <div className="space-y-3">
                      {upcomingAppointments.map((apt) => (
                        <Card key={apt.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{apt.faculty?.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.faculty_profile?.department}
                                </p>
                                {apt.availability_slots && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(apt.availability_slots.start_time), "PPP 'at' p")}
                                  </div>
                                )}
                                {apt.faculty_profile?.chamber_location && (
                                  <p className="text-sm text-muted-foreground">
                                    Location: {apt.faculty_profile.chamber_location}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <Badge variant="default">Confirmed</Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => cancelAppointment(apt.id)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                            {apt.student_notes && (
                              <div className="mt-3 p-2 bg-muted rounded-md">
                                <p className="text-sm text-muted-foreground">Notes: {apt.student_notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {pastAppointments.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Past Appointments</h3>
                    <div className="space-y-3">
                      {pastAppointments.map((apt) => (
                        <Card key={apt.id} className="opacity-75">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">{apt.faculty?.full_name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.faculty_profile?.department}
                                </p>
                                {apt.availability_slots && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Calendar className="h-4 w-4" />
                                    {format(new Date(apt.availability_slots.start_time), "PPP 'at' p")}
                                  </div>
                                )}
                              </div>
                              <Badge variant="secondary">Completed</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}