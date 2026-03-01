"use client";

import { usePathname } from "next/navigation";

export function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  if (isAdmin) return null;
  return <>{children}</>;
}

export function AdminPadding({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  return <div className={isAdmin ? "" : "lg:pl-52"}>{children}</div>;
}
