import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Settings, LogOut, Loader2, Clock } from "lucide-react";
import { format } from "date-fns";

export default function FacultyDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [facultyProfile, setFacultyProfile] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchProfile();
      fetchFacultyProfile();
      fetchAppointments();
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("faculty-appointments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `faculty_id=eq.${user.id}`,
        },
        () => fetchAppointments(),
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

  const fetchFacultyProfile = async () => {
    const { data } = await supabase
      .from("faculty_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    setFacultyProfile(data);
    setLoadingData(false);
  };

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        *,
        availability_slots(start_time, end_time),
        student:profiles!appointments_student_id_fkey(full_name, email)
      `,
      )
      .eq("faculty_id", user!.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching appointments:", error);
    } else {
      setAppointments(data || []);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!facultyProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Complete Your Profile</CardTitle>
              <CardDescription>
                Please set up your faculty profile to start accepting
                appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/faculty/profile")}>
                Set Up Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const now = new Date();

  const upcomingAppointments = appointments.filter(
    (apt) =>
      apt.status === "confirmed" &&
      new Date(apt.availability_slots?.end_time) > now,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Faculty Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {profile?.full_name}!
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/faculty/profile")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>My Profile</CardTitle>
              </div>
              <CardDescription>Manage your faculty information</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/faculty/availability")}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Availability</CardTitle>
              </div>
              <CardDescription>
                Set your consultation time slots
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Manage Slots</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>Upcoming</CardTitle>
              </div>
              <CardDescription>Your scheduled appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {upcomingAppointments.length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Appointments</CardTitle>
            <CardDescription>
              View and manage student consultations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No appointments yet</p>
                <Button
                  className="mt-4"
                  onClick={() => navigate("/faculty/availability")}
                >
                  Set Your Availability
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {upcomingAppointments.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">
                      Upcoming Appointments
                    </h3>
                    <div className="space-y-3">
                      {upcomingAppointments.map((apt) => (
                        <Card key={apt.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-medium">
                                  {apt.student?.full_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.student?.email}
                                </p>
                                {apt.availability_slots && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-4 w-4" />
                                    {format(
                                      new Date(
                                        apt.availability_slots.start_time,
                                      ),
                                      "PPP 'at' p",
                                    )}
                                  </div>
                                )}
                              </div>
                              <Badge variant="default">Confirmed</Badge>
                            </div>
                            {apt.student_notes && (
                              <div className="mt-3 p-2 bg-muted rounded-md">
                                <p className="text-sm">
                                  <strong>Student Notes:</strong>{" "}
                                  {apt.student_notes}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {appointments.filter(
                  (a) =>
                    a.status === "cancelled" ||
                    (a.status === "confirmed" &&
                      new Date(a.availability_slots?.end_time) <= now),
                ).length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Past & Cancelled</h3>
                    <div className="space-y-3">
                      {appointments
                        .filter(
                          (a) =>
                            a.status === "cancelled" ||
                            (a.status === "confirmed" &&
                              new Date(a.availability_slots?.end_time) <= now),
                        )
                        .map((apt) => (
                          <Card key={apt.id} className="opacity-75">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    {apt.student?.full_name}
                                  </p>
                                  {apt.availability_slots && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Calendar className="h-4 w-4" />
                                      {format(
                                        new Date(
                                          apt.availability_slots.start_time,
                                        ),
                                        "PPP 'at' p",
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Badge variant="secondary">{apt.status}</Badge>
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
