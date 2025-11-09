import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Calendar } from "lucide-react";

interface FacultySearchCardProps {
  faculty: {
    id: string;
    full_name: string;
    email: string;
    department: string;
    chamber_location: string | null;
    phone: string | null;
    bio: string | null;
    available_slots_count: number;
  };
  onViewSlots: (facultyId: string) => void;
}

export const FacultySearchCard = ({ faculty, onViewSlots }: FacultySearchCardProps) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{faculty.full_name}</CardTitle>
            <CardDescription>{faculty.email}</CardDescription>
          </div>
          <Badge variant="secondary">{faculty.department}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {faculty.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{faculty.bio}</p>
        )}

        <div className="space-y-2 text-sm">
          {faculty.chamber_location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{faculty.chamber_location}</span>
            </div>
          )}
          {faculty.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{faculty.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{faculty.available_slots_count} available slots</span>
          </div>
        </div>

        <Button 
          className="w-full" 
          onClick={() => onViewSlots(faculty.id)}
          disabled={faculty.available_slots_count === 0}
        >
          {faculty.available_slots_count > 0 ? "View Available Slots" : "No Slots Available"}
        </Button>
      </CardContent>
    </Card>
  );
};