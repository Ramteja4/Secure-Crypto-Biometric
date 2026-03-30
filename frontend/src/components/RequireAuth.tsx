import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken } from "../services/session";

type Props = { children: React.ReactNode };

export default function RequireAuth({ children }: Props) {
  const location = useLocation();
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
