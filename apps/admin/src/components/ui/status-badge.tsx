import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusConfig = {
  label: string;
  className: string;
};

const studentStatusMap: Record<string, StatusConfig> = {
  AWAITING_ASSIGNMENT: {
    label: "Awaiting",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  AWAITING_REASSIGNMENT: {
    label: "Reassignment",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  INACTIVE: {
    label: "Inactive",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const paymentStatusMap: Record<string, StatusConfig> = {
  UNPAID: {
    label: "Unpaid",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  PARTIALLY_PAID: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  OVERPAID: {
    label: "Overpaid",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
};

const lessonStatusMap: Record<string, StatusConfig> = {
  SCHEDULED: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  PENDING_RESOLUTION: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

const groupStatusMap: Record<string, StatusConfig> = {
  BEGINNING: {
    label: "Beginning",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  MID: {
    label: "Mid",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  FINAL: {
    label: "Final",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

const teacherPayStatusMap: Record<string, StatusConfig> = {
  UNPAID: {
    label: "Unpaid",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  PARTIAL: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-800 border-green-200",
  },
};

const refundStatusMap: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
};

const scheduledActionStatusMap: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const statusMaps = {
  student: studentStatusMap,
  payment: paymentStatusMap,
  lesson: lessonStatusMap,
  group: groupStatusMap,
  teacherPay: teacherPayStatusMap,
  refund: refundStatusMap,
  scheduledAction: scheduledActionStatusMap,
} as const;

interface StatusBadgeProps {
  type: keyof typeof statusMaps;
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const map = statusMaps[type];
  const config = map[value];

  if (!config) {
    return (
      <Badge variant="outline" className={className}>
        {value}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
