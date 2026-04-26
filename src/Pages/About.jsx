import { useEffect, useState } from "react";
import { BookOpenText, HeartHandshake, Target, Telescope } from "lucide-react";
import { api } from "../lib/api";
import { PageHero, SectionHeader, SiteLayout } from "../Components/SiteLayout";

const pillars = [
  {
    icon: Target,
    title: "Mission",
    copy: "Make practical learning easier to access, easier to follow, and more connected to real student growth.",
  },
  {
    icon: Telescope,
    title: "Vision",
    copy: "Build a trusted online academy where students can keep learning, collecting proof of progress, and moving toward better opportunities.",
  },
  {
    icon: BookOpenText,
    title: "Purpose",
    copy: "The platform was created to give students a clearer learning experience with real mentoring, live teaching, and progress they can actually track.",
  },
  {
    icon: HeartHandshake,
    title: "Teaching Standard",
    copy: "We choose instructors for clarity, care, practical experience, and the ability to keep students moving instead of feeling left behind.",
  },
];

export default function About() {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    api.get("/teachers").then((payload) => setTeachers(payload.teachers.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="About edUKai"
        title="A learning platform built to feel more human and more practical."
        description="edUKai was created to make online learning easier to follow, easier to trust, and much easier for students to stay connected to."
      />

      <section className="px-6 pb-10 md:px-12">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-lg">
          <h2 className="mb-5 text-3xl font-bold text-primary">Our story</h2>
          <div className="space-y-5 leading-relaxed text-gray-700">
            <p>
              edUKai started from the shared belief that students deserve a learning platform that respects their time, supports their growth, and keeps the path forward clear.
            </p>
            <p>
              The goal from the beginning was not to create a noisy website. It was to create a place where students can join real courses, learn from strong instructors, and keep their progress, classes, reminders, feedback, badges, and certificates in one calm space.
            </p>
            <p>
              As the platform grows, that same purpose stays in place: help students feel guided, not lost.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {pillars.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="rounded-3xl bg-white p-8 shadow-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-primary">
                  <Icon size={22} />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-primary">{title}</h3>
                <p className="mt-3 leading-relaxed text-gray-700">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-7xl rounded-3xl bg-white p-10 shadow-lg">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionHeader
                eyebrow="Teaching quality"
                title="How we choose instructors"
                description="We look for teachers who can explain clearly, care about student progress, and teach from real experience instead of theory alone."
              />
              <p className="mt-4 leading-relaxed text-gray-700">
                That means our instructors are chosen for their communication, consistency, and ability to give useful feedback, not only for their resume.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {teachers.map((teacher) => (
                <article key={teacher.id} className="rounded-2xl bg-purple-50 p-5">
                  <p className="text-lg font-bold text-primary">{teacher.displayName}</p>
                  <p className="mt-2 text-sm font-medium text-secondary">{teacher.teacherProfile?.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{teacher.teacherProfile?.specialty}</p>
                </article>
              ))}
              {!teachers.length ? (
                <div className="rounded-2xl bg-purple-50 p-5 text-sm leading-7 text-slate-600 md:col-span-3">
                  Teacher accounts can be created from the admin dashboard, and featured instructors will appear here once the team is added.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
