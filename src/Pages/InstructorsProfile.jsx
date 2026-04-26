import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { PageHero, SiteLayout } from "../Components/SiteLayout";

export default function InstructorsProfile() {
  const { teacherId } = useParams();
  const [teachers, setTeachers] = useState([]);

  useEffect(() => {
    api.get("/teachers").then((payload) => setTeachers(payload.teachers)).catch(() => {});
  }, []);

  const teacher = useMemo(
    () => teachers.find((entry) => entry.id === teacherId),
    [teacherId, teachers],
  );

  if (!teacher) {
    return (
      <SiteLayout>
        <section className="bg-background px-6 py-20 md:px-12">
          <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-primary">Loading instructor profile...</p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Instructor profile"
        title={teacher.displayName}
        description={teacher.bio}
        aside={
          <div className="surface-subtle p-6">
            <p className="text-sm font-semibold text-purple-700">Teacher score</p>
            <p className="mt-2 text-4xl font-extrabold text-text">{teacher.teacherProfile?.score}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{teacher.teacherProfile?.title}</p>
          </div>
        }
      />

      <section className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-5xl rounded-3xl bg-white p-10 shadow-lg">
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Specialty</p>
              <p className="mt-2 font-bold text-text">{teacher.teacherProfile?.specialty}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Students</p>
              <p className="mt-2 font-bold text-text">{teacher.teacherProfile?.students}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Classes</p>
              <p className="mt-2 font-bold text-text">{teacher.teacherProfile?.classes}</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-5">
              <p className="text-sm font-semibold text-purple-700">Growth</p>
              <p className="mt-2 font-bold text-text">{teacher.teacherProfile?.growth}</p>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
