import { Navigate } from 'react-router-dom';
import { token } from '../../../shared/api/token';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!token.get()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
