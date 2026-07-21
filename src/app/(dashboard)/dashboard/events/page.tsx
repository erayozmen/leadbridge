import { EventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/features/auth/server/auth";
import { changeEventStatusAction, createEventAction, selectActiveEventAction } from "@/features/events/actions/event-actions";
import { getActiveEvent } from "@/features/events/server/active-event";
import { prisma } from "@/lib/prisma";

export default async function EventsPage() {
  await requireAdmin();
  const [events, active] = await Promise.all([prisma.event.findMany({ select: { id:true,name:true,eventDate:true,location:true,status:true,_count:{select:{vrRecords:true,qrCodes:true,qrRegistrations:true}} }, orderBy:{eventDate:"desc"} }),getActiveEvent()]);
  return <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"><h1 className="text-3xl font-semibold">Etkinlikler</h1><p className="mt-2 text-muted-foreground">Operasyonları etkinlik bazında izole edin ve aktif çalışma etkinliğini seçin.</p><div className="mt-8 grid gap-6 xl:grid-cols-[22rem_1fr]"><Card className="p-5"><h2 className="font-semibold">Yeni etkinlik</h2><form action={createEventAction} className="mt-4 grid gap-4"><div><Label htmlFor="name">Ad</Label><Input id="name" name="name" required maxLength={120}/></div><div><Label htmlFor="eventDate">Tarih</Label><Input id="eventDate" name="eventDate" type="datetime-local" required/></div><div><Label htmlFor="location">Konum</Label><Input id="location" name="location" required maxLength={160}/></div><Button>Etkinlik oluştur</Button></form></Card><Card className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Etkinlik</TableHead><TableHead>Durum</TableHead><TableHead>Kayıtlar</TableHead><TableHead>İşlem</TableHead></TableRow></TableHeader><TableBody>{events.map(event=><TableRow key={event.id}><TableCell><strong>{event.name}</strong><br/><span className="text-xs text-muted-foreground">{event.eventDate.toLocaleString("tr-TR")} · {event.location}</span></TableCell><TableCell>{event.status}{active?.id===event.id?" · Seçili":""}</TableCell><TableCell>VR {event._count.vrRecords} · QR {event._count.qrCodes} · Form {event._count.qrRegistrations}</TableCell><TableCell><div className="flex gap-2"><form action={changeEventStatusAction}><input type="hidden" name="eventId" value={event.id}/><select name="status" defaultValue={event.status} className="h-9 rounded-md border bg-background px-2">{Object.values(EventStatus).map(status=><option key={status}>{status}</option>)}</select><Button className="ml-2" variant="outline">Güncelle</Button></form>{event.status===EventStatus.ACTIVE?<form action={selectActiveEventAction}><input type="hidden" name="eventId" value={event.id}/><Button disabled={active?.id===event.id}>Aktif seç</Button></form>:null}</div></TableCell></TableRow>)}</TableBody></Table></Card></div></main>;
}
