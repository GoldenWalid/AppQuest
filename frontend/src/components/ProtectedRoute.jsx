import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <div className="text-center">
          <Loader2 className="mx-auto text-cyan-300 animate-spin mb-3" size={24} />
          <div className="font-accent tracking-[0.4em] uppercase text-xs text-cyan-300/70">
            Reconnaissance...
          </div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
