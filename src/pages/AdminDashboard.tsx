import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Calendar, TrendingUp, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFaculty: 0,
    totalStudents: 0,
    totalAppointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdminRole();
    }
  }, [user, authLoading, navigate]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    // Listen to all changes on the appointments table
    const channel = supabase
      .channel('admin-dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          // When anything changes, re-fetch all stats and recent appointments
          toast.info("Dashboard updated with new activity.");
          fetchStats();
          fetchRecentAppointments();
        }
      )
      .on( // Also listen to changes in user roles
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        (payload) => {
          toast.info("Dashboard updated with new user data.");
          fetchStats();
        }
      )
      .subscribe();

    // Clean up subscription on exit
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const checkAdminRole = async () => {
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .single();

    if (userRole?.role !== "admin") {
      toast.error("Access denied: Admin privileges required");
      navigate("/");
      return;
    }

    // Initial data fetch - now we await them
    await fetchStats();
    await fetchRecentAppointments();
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      // Total Faculty
      const { count: totalFaculty } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "faculty");

      // Total Students
      const { count: totalStudents } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "student");

      // Total Appointments
      const { count: totalAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true });

      // Confirmed Appointments
      const { count: confirmedAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed");

      // Cancelled Appointments
      const { count: cancelledAppointments } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("status", "cancelled");

      // *** FIX: Calculate totalUsers as the sum of faculty and students ***
      const totalUsers = (totalFaculty || 0) + (totalStudents || 0);

      setStats({
        totalUsers: totalUsers, // <-- This is now the correct sum
        totalFaculty: totalFaculty || 0,
        totalStudents: totalStudents || 0,
        totalAppointments: totalAppointments || 0,
        confirmedAppointments: confirmedAppointments || 0,
        cancelledAppointments: cancelledAppointments || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchRecentAppointments = async () => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        availability_slots(start_time, end_time),
        student:profiles!appointments_student_id_fkey(full_name, email),
        faculty:profiles!appointments_faculty_id_fkey(full_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching appointments:", error);
    } else {
      setRecentAppointments(data || []);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalFaculty} faculty, {stats.totalStudents} students
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAppointments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.confirmedAppointments} confirmed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Booking Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalAppointments > 0
                  ? Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.cancelledAppointments} cancelled
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Appointments</CardTitle>
            <CardDescription>Latest booking activity across the system</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No appointments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{apt.student?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{apt.student?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{apt.faculty?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{apt.faculty?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {apt.availability_slots && (
                          <p className="text-sm">
                            {new Date(apt.availability_slots.start_time).toLocaleString()}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            apt.status === "confirmed" ? "default" 
                            : apt.status === "cancelled" ? "destructive" 
                            : "secondary"
                          }
                        >
                          {apt.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}