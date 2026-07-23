import { Button } from "@/components/ui/button";

export function EventFilter({ events, selectedId }: { events: Array<{ id: string; name: string; status: string }>; selectedId: string }) {
  return <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
    <label className="grid gap-1 text-sm font-medium">Etkinlik
      <select name="eventId" defaultValue={selectedId} className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm">
        {events.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.status})</option>)}
      </select>
    </label>
    <Button type="submit" variant="outline">Uygula</Button>
  </form>;
}
