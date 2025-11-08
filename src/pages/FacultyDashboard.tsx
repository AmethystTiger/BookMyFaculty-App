import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, LogOut, Clock, Settings, Users } from "lucide-react";

const FacultyDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      setProfile(data);
      setLoading(false);
    };

    fetchProfile();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">BookMyFaculty</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {profile?.full_name}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Faculty Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your availability and appointments
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Manage Availability */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-card-foreground">
                Availability
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Set and manage your consultation time slots
            </p>
            <Button className="w-full">Manage Slots</Button>
          </Card>

          {/* View Appointments */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-card-foreground">
                Appointments
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              View and manage student bookings
            </p>
            <Button variant="outline" className="w-full">View All</Button>
          </Card>

          {/* Profile Settings */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-card-foreground">
                Profile
              </h2>
            </div>
            <p className="text-muted-foreground mb-4">
              Update your profile and contact details
            </p>
            <Button variant="outline" className="w-full">Edit Profile</Button>
          </Card>
        </div>

        {/* Today's Schedule */}
        <Card className="mt-6 p-6">
          <h2 className="text-2xl font-semibold text-card-foreground mb-4">
            Today's Schedule
          </h2>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No appointments scheduled for today</p>
            <p className="text-sm mt-2">Set up your availability to start receiving bookings</p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default FacultyDashboard;
