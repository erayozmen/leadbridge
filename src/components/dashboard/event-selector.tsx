import { selectEventAction } from "@/features/events/actions/event-context-actions";

export function EventSelector({
  events,
  selectedId,
}: {
  events: Array<{ id: string; name: string }>;
  selectedId?: string;
}) {
  return (
    <form action={selectEventAction} className="flex items-center gap-2">
      <label className="sr-only" htmlFor="active-event">
        Etkinlik seç
      </label>
      <select
        id="active-event"
        name="eventId"
        defaultValue={selectedId ?? ""}
        className="h-9 max-w-44 rounded-md border bg-background px-2 text-sm sm:max-w-56"
      >
        <option value="" disabled>
          Etkinlik seçin
        </option>
        {events.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
      <button
        className="h-9 rounded-md border px-2 text-xs hover:bg-muted"
        type="submit"
      >
        Seç
      </button>
    </form>
  );
}
