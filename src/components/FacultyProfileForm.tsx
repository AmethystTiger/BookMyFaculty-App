import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface FacultyProfileFormProps {
  userId: string;
  existingProfile?: {
    department: string;
    chamber_location: string | null;
    phone: string | null;
    bio: string | null;
  };
}

export const FacultyProfileForm = ({ userId, existingProfile }: FacultyProfileFormProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    department: existingProfile?.department || "",
    chamber_location: existingProfile?.chamber_location || "",
    phone: existingProfile?.phone || "",
    bio: existingProfile?.bio || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = existingProfile
        ? await supabase
            .from("faculty_profiles")
            .update(formData)
            .eq("user_id", userId)
        : await supabase
            .from("faculty_profiles")
            .insert({ ...formData, user_id: userId });

      if (error) throw error;

      toast.success("Profile saved successfully!");
      navigate("/faculty/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faculty Profile Setup</CardTitle>
        <CardDescription>Complete your faculty profile to start accepting appointments</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              placeholder="e.g., Computer Science"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="chamber_location">Chamber Location</Label>
            <Input
              id="chamber_location"
              value={formData.chamber_location}
              onChange={(e) => setFormData({ ...formData, chamber_location: e.target.value })}
              placeholder="e.g., Room 301, Building A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="e.g., +1234567890"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Brief introduction about yourself and your areas of expertise..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existingProfile ? "Update Profile" : "Save Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};