"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <span className="text-lg font-bold tracking-tight">QR Resolution</span>
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {user.role === "ADMIN" && (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={ROUTES.ADMIN_QR}>QR Management</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={ROUTES.ADMIN_LOCATIONS}>Locations</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={ROUTES.ADMIN_TICKETS}>Tickets</Link>
                  </Button>
                </>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.displayName ?? user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Get Started</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
