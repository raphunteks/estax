import { Skeleton } from "@/components/dash/kit";

/** Shown instantly while a dashboard page streams in, so sidebar navigation never feels stuck. */
export default function Loading() {
  return <Skeleton />;
}
