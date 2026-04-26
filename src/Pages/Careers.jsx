import { Link } from "react-router-dom";
import { PageHero, SiteLayout } from "../Components/SiteLayout";

const reasons = [
  "Work closely with founders and educators who care deeply about student outcomes.",
  "Help shape a growing platform built around practical learning and real mentorship.",
  "Join a team that values clarity, care, and meaningful progress over noise.",
];

export default function Careers() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Careers"
        title="Work with a team that cares about how students actually learn."
        description="We are always looking for thoughtful people who want to help students learn better and grow with confidence."
      />

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.9fr]">
          <div className="surface-card p-8">
            <h2 className="mb-5 text-3xl font-bold text-primary">Why join us?</h2>
            <div className="space-y-4 text-gray-700">
              {reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          </div>

          <div className="surface-card p-8">
            <h2 className="mb-5 text-3xl font-bold text-primary">Open positions</h2>
            <p className="mb-6 leading-relaxed text-gray-700">
              Browse our current openings and find the role that fits your experience and interests.
            </p>
            <Link to="/jobs" className="primary-btn">
              View Job Openings
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
