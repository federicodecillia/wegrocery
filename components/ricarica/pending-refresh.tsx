"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// While the webhook has not confirmed the payment yet, re-render the page a
// few times so the banner turns into "credited" without a manual reload.
export function PendingRefresh() {
  const router = useRouter();
  useEffect(() => {
    let runs = 0;
    const id = setInterval(() => {
      runs += 1;
      router.refresh();
      if (runs >= 10) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
