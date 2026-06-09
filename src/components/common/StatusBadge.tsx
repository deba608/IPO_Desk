// src/components/common/StatusBadge.tsx
import { Badge } from "@/components/ui/badge";
import { AllotmentStatus } from "@/types/allotment.types";
import { CheckCircle2, XCircle, AlertCircle, HelpCircle } from "lucide-react";

interface StatusBadgeProps {
  status: AllotmentStatus;
  className?: string;
}

const STATUS_CONFIG = {
  allotted: {
    label: "Allotted",
    icon: CheckCircle2,
    variant: "success" as const,
  },
  not_allotted: {
    label: "Not Allotted",
    icon: XCircle,
    variant: "danger" as const,
  },
  not_found: {
    label: "Not Found",
    icon: HelpCircle,
    variant: "warning" as const,
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    variant: "danger" as const,
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${className ?? ""}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
