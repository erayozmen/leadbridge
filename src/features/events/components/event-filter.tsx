import { Button } from "@/components/ui/button";

export function EventFilter({ events, selectedId }: { events: Array<{ id: string; name: string; status: string }>; selectedId: string }) {
  return <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
    <label className="grid flex-1 gap-2 text-sm font-medium">Etkinlik kapsamı
      <select name="eventId" defaultValue={selectedId} className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm sm:max-w-sm">
        {events.map((event) => <option key={event.id} value={event.id}>{event.name} ({event.status})</option>)}
      </select>
    </label>
    <Button type="submit" variant="outline" className="sm:self-end">Uygula</Button>
  </form>;
}
