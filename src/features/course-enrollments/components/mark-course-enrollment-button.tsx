"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { markCourseEnrollmentAction, type CourseEnrollmentActionState } from "@/features/course-enrollments/actions/course-enrollment-actions";
const initial: CourseEnrollmentActionState = { status: "idle", message: null };
export function MarkCourseEnrollmentButton({ id, studentName }: { id: string; studentName: string }) { const [state, action, pending] = useActionState(markCourseEnrollmentAction, initial); return <form action={action} className="grid gap-2"><input type="hidden" name="qrRegistrationId" value={id} /><p className="text-xs text-muted-foreground">{studentName} dil kursuna kayıtlı olarak işaretlenecek.</p><Button size="sm" disabled={pending}>{pending ? "İşaretleniyor..." : "Dil Kursuna Kaydoldu"}</Button>{state.message ? <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-emerald-700"}>{state.message}</p> : null}</form>; }
