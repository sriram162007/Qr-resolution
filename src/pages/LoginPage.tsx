import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/admin", { replace: true });
    } catch {
      // error handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Campus Pulse
        </Link>
        <span className="text-xs font-medium text-[#86868B]">
          Admin & Staff Portal
        </span>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto py-8">
        <Card className="border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl overflow-hidden bg-white">
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                Staff Authentication
              </h1>
              <p className="text-sm text-[#6E6E73]">
                Enter your institutional credentials to manage campus facility operations.
              </p>
            </div>

            {error && (
              <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FEECEC] p-3.5 text-xs text-[#D70015] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Institutional Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Password
                  </label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)] mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </span>
                ) : (
                  "Sign in to Dashboard"
                )}
              </Button>
            </form>

            {/* Demo Quick Fill for Reviewers / Evaluation */}
            <div className="pt-4 border-t border-black/[0.06] space-y-2">
              <div className="text-[11px] font-medium text-[#86868B] text-center">
                Quick fill for demonstration
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoFill("admin@campus.edu")}
                  className="px-3 py-2 text-xs font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#EAEAEA] active:bg-[#E0E0E2] rounded-xl border border-black/[0.04] transition-colors text-center"
                >
                  Fill Admin
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoFill("staff@campus.edu")}
                  className="px-3 py-2 text-xs font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-[#EAEAEA] active:bg-[#E0E0E2] rounded-xl border border-black/[0.04] transition-colors text-center"
                >
                  Fill Staff
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-[#86868B] pb-2">
        Campus Pulse • Institutional Staff Access • Role-Based Authentication
      </div>
    </div>
  );
}
