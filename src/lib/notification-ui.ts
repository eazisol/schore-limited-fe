import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Percent,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { parseApiDate } from "@/lib/module-ui";
import type { ApiNotification } from "@/lib/api/services/notifications";
import type { StatusTone } from "@/lib/status-colors";
import { STATUS_TONE_CLASSES } from "@/lib/status-colors";

export function notificationRelativeTime(iso: string) {
  try {
    const d = parseApiDate(iso);
    if (!d) return "";
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

export function notificationIconBoxClass(tone: StatusTone) {
  return STATUS_TONE_CLASSES[tone];
}

export function notificationVisual(n: ApiNotification): { tone: StatusTone; Icon: LucideIcon } {
  const type = n.type.toUpperCase();
  const title = n.title.toLowerCase();

  if (type.includes("REJECTED") || type.includes("REFUSED")) {
    return { tone: "destructive", Icon: XCircle };
  }
  if (type.includes("APPROVED") || type.includes("ACCEPTED")) {
    return { tone: "success", Icon: CheckCircle2 };
  }
  if (type.includes("STATEMENT") || type.includes("PAY") || title.includes("payment")) {
    return { tone: "info", Icon: Banknote };
  }
  if (type.includes("RATE")) {
    return { tone: "warning", Icon: Percent };
  }
  if (type.includes("REPEAT") || type.includes("TASK") || title.includes("task")) {
    return { tone: "warning", Icon: ClipboardList };
  }
  if (title.includes("warning") || title.includes("expir")) {
    return { tone: "warning", Icon: AlertTriangle };
  }
  return { tone: "muted", Icon: BellRing };
}

export function notificationTypeLabel(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
