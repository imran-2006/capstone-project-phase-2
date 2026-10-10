import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCreator } from "../context/CreatorContext";
import Layout from "./Layout";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { needsOnboarding, status } = useCreator();

  if (loading || (user && (status === "idle" || status === "loading"))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="animate-spin text-primary-600" size={28} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Layout>{children}</Layout>;
}
