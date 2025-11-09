import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Users, BookOpen, Shield, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Calendar,
      title: "Easy Scheduling",
      description: "Faculty can set their availability and students can book slots in just a few clicks.",
    },
    {
      icon: Clock,
      title: "15-Minute Consultations",
      description: "Quick, focused appointments designed for efficient academic guidance.",
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description: "Separate portals for students, faculty, and administrators with tailored features.",
    },
    {
      icon: BookOpen,
      title: "Faculty Profiles",
      description: "View chamber locations, contact details, and available consultation times.",
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Get instant updates for bookings, cancellations, and upcoming appointments.",
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Real-time updates prevent double bookings with atomic transaction handling.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-8">
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">BookMyFaculty</span>
          </div>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </nav>

        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Welcome to
            <span className="block text-primary mt-2">BookMyFaculty</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A modern platform that makes scheduling consultations effortless. Connect with faculty, book time slots, and manage appointments—all in one place.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" className="text-lg px-8" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed for seamless appointment management in academic settings.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 hover:shadow-hover transition-all duration-300 border-border bg-card"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border">
        <div className="text-center text-muted-foreground">
          <p>&copy; 2025 BookMyFaculty. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index; 