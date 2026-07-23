import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/features/auth/server/auth";
import { requireSelectedEvent } from "@/features/events/server/event-context";
import { CreateMatchButton, DeleteMatchButton } from "@/features/student-matching/components/match-action-buttons";
import { getVrMatchTarget, listQrRegistrations } from "@/features/student-matching/queries/list-qr-registrations";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
const date = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" });
function href(id: string, page: number, filters: { firstName?: string; lastName?: string; school?: string }) { const q = new URLSearchParams(); Object.entries(filters).forEach(([k,v]) => { if(v) q.set(k,v); }); if(page > 1) q.set("page",String(page)); return `/dashboard/vr-records/${id}/match-registration${q.size ? `?${q}` : ""}`; }

export default async function MatchRegistrationPage({ params, searchParams }: Props) {
  await requireAdmin();
  const event = await requireSelectedEvent();
  const { id } = await params;
  const vr = await getVrMatchTarget(id, event.id);
  if (!vr) notFound();
  const name = `${vr.firstName} ${vr.lastName}`;
  if (vr.studentMatch) {
    const qr = vr.studentMatch.qrRegistration;
    return <main className="mx-auto max-w-3xl px-4 py-8"><Button asChild variant="ghost"><Link href="/dashboard/vr-records"><ArrowLeft />VR kayıtlarına dön</Link></Button><h1 className="mt-6 text-3xl font-semibold">Eşleşme Yönetimi</h1><Card className="mt-8 rounded-lg shadow-none"><CardHeader><Badge className="w-fit">Eşleşti</Badge><CardTitle>{name}</CardTitle></CardHeader><CardContent className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">VR kaydı</p><p className="mt-1 font-medium">{name}</p><p className="text-sm text-muted-foreground">{vr.school}</p></div><div><p className="text-xs text-muted-foreground">QR kaydı</p><p className="mt-1 font-medium">{qr.firstName} {qr.lastName}</p><p className="text-sm text-muted-foreground">{qr.school} · {qr.phone}</p><p className="mt-1 font-mono text-xs">{qr.qrCode.serialNumber}</p></div></div><p className="text-sm text-muted-foreground">Eşleştirme: {date.format(vr.studentMatch.matchedAt)}</p><DeleteMatchButton matchId={vr.studentMatch.id} vrRecordId={vr.id} qrRegistrationId={qr.id} vrStudentName={name} qrStudentName={`${qr.firstName} ${qr.lastName}`} /></CardContent></Card></main>;
  }
  const p = await searchParams;
  const filters = { firstName: first(p.firstName), lastName: first(p.lastName), school: first(p.school) };
  const result = await listQrRegistrations({ ...filters, eventId: event.id, page: Number(first(p.page)) }, { unmatchedOnly: true });
  return <main className="mx-auto max-w-5xl px-4 py-8"><Button asChild variant="ghost"><Link href="/dashboard/vr-records"><ArrowLeft />VR kayıtlarına dön</Link></Button><h1 className="mt-6 text-3xl font-semibold">QR Kaydıyla Eşleştir</h1><p className="mt-2 text-muted-foreground">VR kaydı: {name} / {vr.school}</p><Card className="mt-8 gap-0 overflow-hidden rounded-lg py-0 shadow-none"><form method="get" className="grid gap-4 border-b p-5 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">{[["firstName","Ad"],["lastName","Soyad"],["school","Okul"]].map(([key,label]) => <div key={key} className="grid gap-2"><Label htmlFor={key}>{label}</Label><Input id={key} name={key} defaultValue={filters[key as keyof typeof filters]} /></div>)}<div className="flex gap-2"><Button type="submit"><Search />Ara</Button><Button asChild variant="outline"><Link href={href(id,1,{})}>Temizle</Link></Button></div></form>{result.records.length ? <div className="divide-y">{result.records.map(qr => <div key={qr.id} className="grid gap-4 p-5 md:grid-cols-[1fr_1fr] md:items-center"><div><p className="font-medium">QR kaydı: {qr.firstName} {qr.lastName} / {qr.school} / {qr.phone}</p><p className="mt-1 text-sm text-muted-foreground">Veli: {qr.guardianName} · {date.format(qr.registeredAt)}</p><p className="mt-1 font-mono text-xs">{qr.qrCode.serialNumber}</p></div><div><p className="mb-3 text-sm">Bu iki kayıt eşleştirilecek.</p><CreateMatchButton vrRecordId={id} qrRegistrationId={qr.id} /></div></div>)}</div> : <div className="p-10 text-center">{result.hasFilters ? "Aramayla eşleşen kayıt bulunamadı." : "Henüz eşleşmemiş QR kaydı yok."}</div>}<div className="flex justify-between border-t p-5 text-sm"><span>Toplam {result.total} · Sayfa {result.page}/{result.pageCount}</span><div className="flex gap-2"><Button size="sm" variant="outline" asChild={result.page>1} disabled={result.page<=1}>{result.page>1?<Link href={href(id,result.page-1,filters)}>Önceki</Link>:<span>Önceki</span>}</Button><Button size="sm" variant="outline" asChild={result.page<result.pageCount} disabled={result.page>=result.pageCount}>{result.page<result.pageCount?<Link href={href(id,result.page+1,filters)}>Sonraki</Link>:<span>Sonraki</span>}</Button></div></div></Card></main>;
}
