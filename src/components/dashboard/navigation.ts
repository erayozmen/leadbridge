export type DashboardRole = "ADMIN" | "STAFF";

export type DashboardNavItem = {
  label: string;
  icon: "overview" | "students" | "vr" | "qr" | "attendance" | "course" | "reports" | "users";
  href?: "/dashboard" | "/dashboard/vr-records" | "/dashboard/vr-records/new" | "/dashboard/qr-codes" | "/dashboard/qr-registrations" | "/dashboard/attendance" | "/dashboard/schools" | "/dashboard/course-enrollments";
  comingSoon?: boolean;
};

const adminNavigation: DashboardNavItem[] = [
  { label: "Genel Bakış", icon: "overview", href: "/dashboard" },
  { label: "VR Kaydı", icon: "vr", href: "/dashboard/vr-records/new" },
  { label: "VR İzleyenler", icon: "vr", href: "/dashboard/vr-records" },
  { label: "QR Kayıtları", icon: "qr", href: "/dashboard/qr-registrations" },
  { label: "Etkinlik Katılımı", icon: "attendance", href: "/dashboard/attendance" },
  { label: "Dil Kursu Kayıtları", icon: "course", href: "/dashboard/course-enrollments" },
  { label: "QR Yönetimi", icon: "qr", href: "/dashboard/qr-codes" },
  { label: "Okullar", icon: "students", href: "/dashboard/schools" },
  { label: "Raporlar", icon: "reports", comingSoon: true },
  { label: "Kullanıcılar", icon: "users", comingSoon: true },
];

const staffNavigation: DashboardNavItem[] = [
  { label: "VR Kaydı", icon: "vr", href: "/dashboard/vr-records/new" },
  { label: "VR İzleyenler", icon: "students", href: "/dashboard/vr-records" },
  { label: "Etkinlik Katılımı", icon: "attendance", href: "/dashboard/attendance" },
];

export function getDashboardNavigation(role: DashboardRole): DashboardNavItem[] {
  return role === "ADMIN" ? adminNavigation : staffNavigation;
}
