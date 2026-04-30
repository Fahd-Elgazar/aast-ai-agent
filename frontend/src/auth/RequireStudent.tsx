import type { JSX } from "react";
import { Navigate } from "react-router-dom";

const RequireStudent = ({ children }: { children: JSX.Element }) => {
  // TEMP user role (later from backend / login)
  const user = {
    role: "guest" // change to "student" to test
  };

  if (user.role !== "student") {
    return <Navigate to="/guest" replace />;
  }

  return children;
};

export default RequireStudent;
