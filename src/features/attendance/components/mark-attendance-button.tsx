"use client";
import{useActionState}from"react";
import{Button}from"@/components/ui/button";
import{markAttendanceAction,type AttendanceActionState}from"@/features/attendance/actions/attendance-actions";
const initial:AttendanceActionState={status:"idle",message:null};
export function MarkAttendanceButton({id,studentName}:{id:string;studentName:string}){const[state,action,pending]=useActionState(markAttendanceAction,initial);return <div className="space-y-2"><p className="text-xs text-muted-foreground">{studentName} adlı öğrenci etkinliğe katıldı olarak işaretlenecek.</p><form action={action}><input type="hidden" name="qrRegistrationId" value={id}/><Button className="min-h-10" disabled={pending} size="sm">{pending?"İşaretleniyor...":"Etkinliğe Geldi"}</Button></form>{state.message?<p role="status" className={state.status==="success"?"text-xs text-emerald-700":"text-xs text-destructive"}>{state.message}</p>:null}</div>}
