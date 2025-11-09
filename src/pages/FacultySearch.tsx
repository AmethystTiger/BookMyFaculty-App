import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FacultySearchCard } from "@/components/FacultySearchCard";
import { BookingModal } from "@/components/BookingModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ArrowLeft, Calendar } from "lucide-react";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function FacultySearch() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [faculty, setFaculty] = useState<any[]>([]);
  const [filteredFaculty, setFilteredFaculty] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [bookingSlot, setBookingSlot] = useState<any>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedFacultyName, setSelectedFacultyName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      fetchFaculty();
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    filterFaculty();
  }, [searchTerm, departmentFilter, faculty]);

  const fetchFaculty = async () => {
    try {
      const { data: facultyData, error } = await supabase
        .from("faculty_profiles")
        .select(`
          *,
          profiles!inner(id, full_name, email)
        `);

      if (error) throw error;

      // Get available slots count for each faculty
      const facultyWithSlots = await Promise.all(
        (facultyData || []).map(async (fac) => {
          const { count } = await supabase
            .from("availability_slots")
            .select("*", { count: "exact", head: true })
            .eq("faculty_id", fac.user_id)
            .eq("is_booked", false)
            .gte("start_time", new Date().toISOString());

          return {
            id: fac.user_id,
            full_name: fac.profiles.full_name,
            email: fac.profiles.email,
            department: fac.department,
            chamber_location: fac.chamber_location,
            phone: fac.phone,
            bio: fac.bio,
            available_slots_count: count || 0,
          };
        })
      );

      setFaculty(facultyWithSlots);
      setFilteredFaculty(facultyWithSlots);

      // Extract unique departments
      const uniqueDepts = [...new Set(facultyWithSlots.map((f) => f.department))];
      setDepartments(uniqueDepts);
    } catch (error: any) {
      console.error("Error fetching faculty:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterFaculty = () => {
    let filtered = faculty;

    if (searchTerm) {
      filtered = filtered.filter(
        (f) =>
          f.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (departmentFilter !== "all") {
      filtered = filtered.filter((f) => f.department === departmentFilter);
    }

    setFilteredFaculty(filtered);
  };

  const handleViewSlots = async (facultyId: string) => {
    setSelectedFacultyId(facultyId);
    const { data, error } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("faculty_id", facultyId)
      .eq("is_booked", false)
      .gte("start_time", new Date().toISOString())
      .order("start_time");

    if (error) {
      console.error("Error fetching slots:", error);
    } else {
      setAvailableSlots(data || []);
    }
  };

  const handleBookSlot = (slot: any, facultyName: string) => {
    setBookingSlot(slot);
    setSelectedFacultyName(facultyName);
    setBookingModalOpen(true);
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/student/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Find Faculty</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find faculty members and book consultation slots</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {selectedFacultyId ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available Time Slots</CardTitle>
                <Button variant="outline" onClick={() => setSelectedFacultyId(null)}>
                  Back to Search
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availableSlots.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No available slots</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {availableSlots.map((slot) => (
                    <Card key={slot.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(slot.start_time), "PPP")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(slot.start_time), "p")} -{" "}
                          {format(new Date(slot.end_time), "p")}
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleBookSlot(slot, filteredFaculty.find(f => f.id === selectedFacultyId)?.full_name || "")}
                        >
                          Book This Slot
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredFaculty.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-12">
                No faculty members found
              </p>
            ) : (
              filteredFaculty.map((fac) => (
                <FacultySearchCard
                  key={fac.id}
                  faculty={fac}
                  onViewSlots={handleViewSlots}
                />
              ))
            )}
          </div>
        )}
      </div>

      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        slot={bookingSlot}
        facultyName={selectedFacultyName}
        studentId={user!.id}
        onSuccess={() => {
          handleViewSlots(selectedFacultyId!);
          fetchFaculty();
        }}
      />
    </div>
  );
}