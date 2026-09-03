import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-[10.5px] font-normal",
        ok ? "border-primary/40 text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-primary" : "bg-muted-foreground/40")} />
      {label}
    </Badge>
  );
}
