import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Logged in as {user?.email}</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Logout
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Link to="/admin/organization">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Organization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage organization settings.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/locations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Locations</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage locations and hierarchy.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/qr">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Manage QR codes for locations.</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/tickets">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">View and manage reported issues.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
