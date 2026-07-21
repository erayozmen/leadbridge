"use client";

import { EventStatus } from "@prisma/client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  advanceEventStatusAction,
  type EventActionState,
} from "@/features/events/actions/event-actions";

const nextStatus: Partial<Record<EventStatus, EventStatus>> = {
  DRAFT: EventStatus.ACTIVE,
  ACTIVE: EventStatus.COMPLETED,
  COMPLETED: EventStatus.ARCHIVED,
};

export function EventStatusAction({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const [open, setOpen] = useState(false);
  const initialState: EventActionState = { status: "idle", message: null };
  const [state, action, pending] = useActionState(
    advanceEventStatusAction,
    initialState,
  );
  const target = nextStatus[status];

  if (!target) return null;

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="status" value={target} />
      {open ? (
        <>
          <p className="text-sm">
            Durum {status} durumundan {target} durumuna ilerletilecek. Bu işlem
            geriye alınamaz.
          </p>
          <Input
            name="reason"
            required
            minLength={10}
            maxLength={500}
            placeholder="İşlem nedeni"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button disabled={pending}>Kesin onay</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Vazgeç
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          Sonraki duruma ilerlet
        </Button>
      )}
      {state.message ? (
        <p
          role="status"
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-emerald-700"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
