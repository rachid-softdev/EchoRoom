import { notFound } from "next/navigation";
import ErrorComponent from "@/app/error";

export default function ErrorPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const mockError = new globalThis.Error("This is a preview of the error boundary component.");
  (mockError as globalThis.Error & { digest?: string }).digest = "DEV_PREVIEW_001";

  return <ErrorComponent error={mockError} reset={() => {}} />;
}
