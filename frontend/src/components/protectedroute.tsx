// src/components/protectedroute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getUser } from "../lib/auth";

type Props = {
  children: React.ReactNode;
  allowedRanks?: number[]; // ถ้ากำหนด จะเช็คสิทธิ์
};

export default function ProtectedRoute({ children, allowedRanks }: Props) {
  const user = getUser();
  const loc = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }

  if (allowedRanks && !allowedRanks.includes(user.rankId)) {
    // ถ้าเป็นญาติ ให้เด้งไปหน้าเยี่ยมญาติ
    if (user.rankId === 3) {
      return <Navigate to="/visition" replace />;
    }
    // อื่น ๆ เด้งไปหน้าแรก
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
