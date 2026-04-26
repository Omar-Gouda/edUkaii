import { useState } from "react";

const Community = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`Thanks for joining! We'll send updates to ${email}`);
    setEmail("");
  };

  return (
    <section
      aria-labelledby="community-title"
      className="my-12 rounded-xl bg-background px-6 py-12 md:px-16"
    >
      <h3
        id="community-title"
        className="mb-6 text-center text-3xl font-bold md:text-4xl"
      >
        Join Our Community
      </h3>

      <div className="mx-auto max-w-xl rounded-xl bg-background p-6 text-center shadow-lg">
        <p className="mb-4 text-text/90">
          Be part of the <strong>first cohort</strong> of edUKai learners.
          Get early access, mentorship, and special perks for joining now!
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col justify-center gap-3 sm:flex-row">
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded-lg border border-primary bg-white px-4 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-6 py-2 text-white transition hover:bg-secondary"
          >
            Join Now
          </button>
        </form>
      </div>
    </section>
  );
};

export default Community;
