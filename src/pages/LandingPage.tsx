import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          QR Resolution
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          QR-based issue reporting system
        </p>
        <div>
          <Button asChild size="lg">
            <Link to="/login">Admin Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
