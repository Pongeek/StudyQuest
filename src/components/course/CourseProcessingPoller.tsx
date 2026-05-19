"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CourseProcessingPoller({ courseId }: { courseId: string }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/status`);
        if (!res.ok) return;
        const { status } = await res.json();
        if (status === "ready" || status === "error") {
          clearInterval(interval);
          router.refresh();
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [courseId, router]);

  return null;
}
