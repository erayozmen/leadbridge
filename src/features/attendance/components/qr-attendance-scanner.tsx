"use client";

import { Camera, Keyboard, ScanLine } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scanAttendanceAction } from "@/features/attendance/actions/scanner-action";

type Detector = { detect(source: ImageBitmapSource): Promise<Array<{rawValue:string}>> };
type DetectorConstructor = new (options:{formats:string[]} )=>Detector;
function tokenFromValue(value:string){try{const url=new URL(value);const parts=url.pathname.split("/").filter(Boolean);return parts[0]==="r"?parts[1]??"":value.trim();}catch{return value.trim();}}

export function QrAttendanceScanner(){
  const video=useRef<HTMLVideoElement>(null);const stream=useRef<MediaStream|null>(null);const [message,setMessage]=useState("Kamerayı başlatın veya QR bağlantısını girin.");const [manual,setManual]=useState("");const [active,setActive]=useState(false);const [pending,startTransition]=useTransition();
  const submit=(value:string)=>{const token=tokenFromValue(value);if(!token||pending)return;startTransition(async()=>{const result=await scanAttendanceAction(token);setMessage(result.ok?`${result.studentName} katıldı olarak işaretlendi.`:result.message);});};
  useEffect(()=>()=>stream.current?.getTracks().forEach(track=>track.stop()),[]);
  async function start(){try{const DetectorApi=(window as unknown as {BarcodeDetector?:DetectorConstructor}).BarcodeDetector;if(!DetectorApi){setMessage("Bu tarayıcı kamera ile QR okumayı desteklemiyor. Manuel girişi kullanın.");return;}stream.current=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});if(video.current){video.current.srcObject=stream.current;await video.current.play();}setActive(true);const detector=new DetectorApi({formats:["qr_code"]});const tick=async()=>{if(!video.current||!stream.current)return;try{const values=await detector.detect(video.current);if(values[0]?.rawValue){stream.current.getTracks().forEach(track=>track.stop());stream.current=null;setActive(false);submit(values[0].rawValue);return;}}catch{}requestAnimationFrame(tick);};requestAnimationFrame(tick);}catch{setMessage("Kamera izni alınamadı. Tarayıcı ayarlarını kontrol edin veya manuel girişi kullanın.");}}
  return <div className="grid gap-6"><div className="relative aspect-video overflow-hidden rounded-md bg-black"><video ref={video} playsInline muted className="size-full object-cover"/><div className="pointer-events-none absolute inset-0 grid place-items-center"><ScanLine className="size-20 text-white/70"/></div></div><p role="status" className="rounded-md border bg-muted/30 p-4 text-sm">{pending?"Katılım doğrulanıyor…":message}</p><Button type="button" onClick={start} disabled={active||pending}><Camera/> {active?"Kamera açık":"Kamerayı başlat"}</Button><form onSubmit={event=>{event.preventDefault();submit(manual);}} className="grid gap-3"><label htmlFor="manual-token" className="text-sm font-medium">Manuel QR bağlantısı</label><div className="flex gap-2"><Input id="manual-token" value={manual} onChange={event=>setManual(event.target.value)} autoComplete="off" placeholder="QR bağlantısını yapıştırın" disabled={pending}/><Button disabled={pending||!manual.trim()}><Keyboard/>İşle</Button></div></form></div>;
}
