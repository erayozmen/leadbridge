import { Label } from "@/components/ui/label";
import { PAGE_SIZE_OPTIONS } from "@/lib/query-pagination";

export function PageSizeSelect({ value }: { value?: number }) {
  return <div className="grid gap-2"><Label htmlFor="pageSize">Sayfa Boyutu</Label><select id="pageSize" name="pageSize" defaultValue={value || 25} className="h-9 rounded-md border bg-background px-3 text-sm">{PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}</select></div>;
}

export function SortSelect({ value, dateLabel = "En yeni" }: { value?: string; dateLabel?: string }) {
  return <div className="grid gap-2"><Label htmlFor="sort">Sıralama</Label><select id="sort" name="sort" defaultValue={value || "newest"} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="newest">{dateLabel}</option><option value="oldest">En eski</option><option value="name-asc">Ada göre A-Z</option><option value="name-desc">Ada göre Z-A</option></select></div>;
}
