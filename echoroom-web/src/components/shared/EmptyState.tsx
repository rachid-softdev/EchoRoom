import type { LucideIcon } from "lucide-react";
import { EmptyState as EmptyStateUI } from "@echoroom/ui";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <EmptyStateUI
      icon={<Icon className="h-16 w-16 text-muted-foreground" />}
      title={title}
      description={description}
      action={action}
    />
  );
}
