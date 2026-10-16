import { count } from "drizzle-orm";
import { db } from "@/db";
import { appointments, patients, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo";

let seeded = false;

export async function ensureSeed() {
  if (seeded) return;

  const [existing] = await db.select({ value: count() }).from(users);
  if (existing.value > 0) {
    seeded = true;
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const created = await db
    .insert(users)
    .values([
      {
        fullName: "Dr. Amelia Chen",
        email: DEMO_EMAIL,
        passwordHash,
        role: "clinician",
        title: "Chief Medical Officer",
        specialty: "Cardiology",
        organization: "Northwell Clinical Group",
      },
      {
        fullName: "James Okonkwo",
        email: "tina.r@example.net",
        passwordHash,
        role: "admin",
        title: "Practice Administrator",
        specialty: "Operations",
        organization: "Northwell Clinical Group",
      },
      {
        fullName: "Dr. Sofia Alvarez",
        email: "henry.w@example.net",
        passwordHash,
        role: "clinician",
        title: "Attending Physician",
        specialty: "Emergency Medicine",
        organization: "Northwell Clinical Group",
      },
    ])
    .returning({ id: users.id, email: users.email });

  const amelia = created.find((user) => user.email === DEMO_EMAIL);

  await db.insert(patients).values([
    { fullName: "Margaret Liu", mrn: "MRN-482193", status: "stable", department: "Cardiology", lastVisit: hoursAgo(6) },
    { fullName: "David Okoye", mrn: "MRN-482204", status: "observation", department: "Internal Medicine", lastVisit: hoursAgo(3) },
    { fullName: "Elena Rossi", mrn: "MRN-482218", status: "critical", department: "ICU", lastVisit: hoursAgo(1) },
    { fullName: "Priya Nair", mrn: "MRN-482231", status: "stable", department: "Endocrinology", lastVisit: hoursAgo(26) },
    { fullName: "Thomas Brennan", mrn: "MRN-482247", status: "recovery", department: "Orthopedics", lastVisit: hoursAgo(8) },
    { fullName: "Aisha Rahman", mrn: "MRN-482259", status: "stable", department: "Pediatrics", lastVisit: hoursAgo(12) },
    { fullName: "Noah Feldman", mrn: "MRN-482266", status: "observation", department: "Pulmonology", lastVisit: hoursAgo(2) },
    { fullName: "Grace Park", mrn: "MRN-482278", status: "stable", department: "Cardiology", lastVisit: hoursAgo(30) },
  ]);

  await db.insert(appointments).values([
    { patientName: "Margaret Liu", clinicianId: amelia?.id, reason: "Post-stent follow-up", scheduledAt: hoursFromNow(0.75), status: "checked-in" },
    { patientName: "Noah Feldman", clinicianId: amelia?.id, reason: "Spirometry review", scheduledAt: hoursFromNow(1.5), status: "scheduled" },
    { patientName: "Priya Nair", clinicianId: amelia?.id, reason: "Diabetes panel", scheduledAt: hoursFromNow(2.25), status: "scheduled" },
    { patientName: "Grace Park", clinicianId: amelia?.id, reason: "New patient consult", scheduledAt: hoursFromNow(3.5), status: "scheduled" },
    { patientName: "David Okoye", clinicianId: amelia?.id, reason: "Medication titration", scheduledAt: hoursFromNow(5), status: "scheduled" },
    { patientName: "Thomas Brennan", clinicianId: amelia?.id, reason: "Pre-op clearance", scheduledAt: hoursFromNow(6.5), status: "scheduled" },
  ]);

  seeded = true;
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
