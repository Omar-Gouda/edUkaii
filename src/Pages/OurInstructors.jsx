import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHero, SiteLayout } from "../Components/SiteLayout";

export default function OurInstructors() {
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    api.get("/teachers").then((payload) => setTeachers(payload.teachers)).catch(() => {});
  }, []);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Our instructors"
        title="Meet the people guiding students through the platform."
        description="Instructor profiles stay grounded in practical teaching, student support, and the confidence they help learners build."
      />

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2">
          {teachers.map((teacher) => (
            <article key={teacher.id} className="surface-card flex h-full flex-col p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-primary">{teacher.displayName}</h2>
                  <p className="mt-2 text-lg font-medium text-secondary">{teacher.teacherProfile?.title}</p>
                </div>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                  {teacher.teacherProfile?.score} score
                </span>
              </div>
              <p className="mt-5 flex-1 leading-relaxed text-gray-700">{teacher.bio}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-primary">
                  {teacher.teacherProfile?.specialty}
                </span>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-primary">
                  {teacher.teacherProfile?.students} students
                </span>
              </div>
              <Link to={`/teachers/${teacher.id}`} className="mt-6 rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white transition hover:bg-secondary">
                View Profile
              </Link>
            </article>
          ))}
          {!teachers.length ? (
            <div className="surface-subtle p-6 text-sm leading-7 text-slate-600 md:col-span-2">
              No instructor accounts are published yet. Admins and moderators can add staff from the dashboard and they will appear here automatically.
            </div>
          ) : null}
        </div>
      </section>
    </SiteLayout>
  );
}
