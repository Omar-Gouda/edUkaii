export const roles = [
  { value: "admin", label: "Admin" },
  { value: "moderator", label: "Moderator" },
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
];

export const roleDashboardCopy = {
  admin: {
    title: "Platform control room",
    summary:
      "Approve teacher hiring, confirm course edits, review workforce demand, and keep every learning flow running cleanly.",
    stats: [
      { label: "Pending approvals", value: "18", tone: "brand" },
      { label: "Open hiring roles", value: "06", tone: "accent" },
      { label: "Course health", value: "94%", tone: "info" },
      { label: "Retention trend", value: "+11%", tone: "gold" },
    ],
    priorities: [
      "Approve moderator course edits before publishing them to students.",
      "Review teacher hiring funnel and move shortlisted applicants to interviews.",
      "Monitor meeting-room attendance and certificate issuance quality.",
    ],
  },
  moderator: {
    title: "Operations and quality desk",
    summary:
      "Handle score reviews, verify classroom incidents, support hiring, and keep feedback loops honest and actionable.",
    stats: [
      { label: "Feedback to review", value: "27", tone: "brand" },
      { label: "Absence proofs", value: "04", tone: "accent" },
      { label: "Students verified", value: "152", tone: "info" },
      { label: "Escalations open", value: "03", tone: "gold" },
    ],
    priorities: [
      "Validate sick-leave documents before class cancellation records close.",
      "Apply teacher feedback scores to the student leaderboard.",
      "Contact inactive students to confirm their learning experience.",
    ],
  },
  teacher: {
    title: "Teaching performance desk",
    summary:
      "Manage class timing, track learner growth, schedule 1:1 reviews, and keep recorded lessons tied to feedback and outcomes.",
    stats: [
      { label: "Classes today", value: "05", tone: "brand" },
      { label: "1:1 reviews", value: "08", tone: "accent" },
      { label: "Growth score", value: "91%", tone: "info" },
      { label: "Delay tokens left", value: "02", tone: "gold" },
    ],
    priorities: [
      "Launch class rooms only inside class time and log any delay instantly.",
      "Review enrolled students who need intervention before assessments.",
      "Leave confidential notes after each mentoring conversation.",
    ],
  },
  student: {
    title: "Learning home base",
    summary:
      "Study with focus, watch replays, collect badges, and keep a clear path from curiosity to certificate.",
    stats: [
      { label: "Courses in progress", value: "03", tone: "brand" },
      { label: "Next live class", value: "18:30", tone: "accent" },
      { label: "Badge streak", value: "12 days", tone: "info" },
      { label: "Completion pace", value: "88%", tone: "gold" },
    ],
    priorities: [
      "Watch the replay from your last session before the next live class.",
      "Ask for a 1:1 review when your score trend dips for two weeks.",
      "Choose whether newly earned badges stay private or public.",
    ],
  },
};

export const courses = [
  {
    slug: "frontend",
    title: "Frontend Development",
    level: "Career Track",
    duration: "16 weeks",
    format: "Live classes + replay library",
    teacherId: "omar-gouda",
    blurb:
      "From HTML and React fundamentals to polished product thinking, with mentoring, peer critique, and portfolio outcomes.",
    image: "/src/assets/images/frontend-development.webp",
    outcomes: ["Responsive interfaces", "State management", "Portfolio reviews", "Mock interviews"],
    modules: ["UI foundations", "React systems", "API workflows", "Capstone launch"],
    audience: ["Career switchers", "Junior developers", "Students building portfolios"],
    accent: "from-cyan-500 to-blue-600",
  },
  {
    slug: "english",
    title: "English Language",
    level: "Communication Track",
    duration: "12 weeks",
    format: "Speaking labs + practice circles",
    teacherId: "mariam-ramadan",
    blurb:
      "Fluency sessions focused on conversation confidence, listening, and academic clarity with teacher-led feedback.",
    image: "/src/assets/images/English-lang-course.webp",
    outcomes: ["Speaking confidence", "Listening stamina", "Writing feedback", "Presentation practice"],
    modules: ["Diagnostic placement", "Conversation labs", "Presentation coaching", "Certification prep"],
    audience: ["School learners", "University students", "Professionals improving fluency"],
    accent: "from-emerald-500 to-teal-600",
  },
  {
    slug: "interpretation",
    title: "Simultaneous Interpretation",
    level: "Advanced Track",
    duration: "10 weeks",
    format: "Workshop-based",
    teacherId: "layla-farid",
    blurb:
      "Practice memory discipline, high-speed listening, and confident dual-language delivery inside realistic event scenarios.",
    image: "/src/assets/images/Simultaneous-Interpretation.webp",
    outcomes: ["Conference drills", "Memory techniques", "Pressure handling", "Feedback recordings"],
    modules: ["Listening control", "Interpretation drills", "Live event simulation", "Mentor review"],
    audience: ["Language specialists", "Advanced English learners", "Aspiring interpreters"],
    accent: "from-orange-500 to-rose-500",
  },
  {
    slug: "hr",
    title: "Human Resources Management",
    level: "Professional Track",
    duration: "14 weeks",
    format: "Case-study sessions",
    teacherId: "salma-adel",
    blurb:
      "Learn hiring, onboarding, employee support, and people operations through practical scenarios and policy exercises.",
    image: "/src/assets/images/Human-resources.webp",
    outcomes: ["Recruitment workflows", "People operations", "Policy writing", "Interview design"],
    modules: ["Hiring systems", "Performance reviews", "Workforce analytics", "Policy clinic"],
    audience: ["New HR staff", "Operations leads", "People team assistants"],
    accent: "from-sky-500 to-indigo-600",
  },
];

export const teachers = [
  {
    id: "mariam-ramadan",
    name: "Mariam Ramadan",
    title: "Lead English Educator",
    specialty: "Fluency coaching and learner confidence",
    score: 98,
    students: 146,
    classes: 12,
    growth: "+14%",
    rank: 1,
    note:
      "Known for warm feedback loops, focused practice plans, and classes that keep quiet students participating.",
  },
  {
    id: "omar-gouda",
    name: "Omar Gouda",
    title: "Frontend Engineering Mentor",
    specialty: "Project-based React learning",
    score: 96,
    students: 112,
    classes: 9,
    growth: "+11%",
    rank: 2,
    note:
      "Blends product critique, engineering structure, and portfolio polishing so students leave with real work to show.",
  },
  {
    id: "salma-adel",
    name: "Salma Adel",
    title: "HR Operations Coach",
    specialty: "People systems and hiring readiness",
    score: 94,
    students: 89,
    classes: 7,
    growth: "+9%",
    rank: 3,
    note:
      "Turns policy-heavy topics into clear operating playbooks that students can use at work immediately.",
  },
  {
    id: "layla-farid",
    name: "Layla Farid",
    title: "Interpretation Trainer",
    specialty: "Conference simulation and live delivery",
    score: 92,
    students: 54,
    classes: 6,
    growth: "+8%",
    rank: 4,
    note:
      "Sharpens speed, memory, and calm under pressure through demanding but supportive live practice.",
  },
];

export const jobs = [
  {
    id: "english-mentor",
    title: "English Mentor",
    team: "Teaching",
    type: "Part-time",
    location: "Remote",
    summary: "Support speaking labs, leave progress notes, and host weekly practice circles.",
  },
  {
    id: "frontend-coach",
    title: "Frontend Coach",
    team: "Teaching",
    type: "Contract",
    location: "Remote",
    summary: "Guide portfolio reviews, code critique sessions, and live workshops for new developers.",
  },
  {
    id: "student-success",
    title: "Student Success Specialist",
    team: "Operations",
    type: "Full-time",
    location: "Hybrid",
    summary: "Verify student experience, follow up on attendance risks, and translate feedback into action.",
  },
  {
    id: "moderator-qa",
    title: "Moderator, Learning QA",
    team: "Moderation",
    type: "Full-time",
    location: "Remote",
    summary: "Audit class records, validate absence proofs, and review course edit requests before admin approval.",
  },
];

export const studentLeaderboard = [
  { name: "Alaa Tarek", score: 98, badge: "Fast Finisher" },
  { name: "Lina Ahmed", score: 96, badge: "Peer Helper" },
  { name: "Nour Magdy", score: 95, badge: "Class Consistency" },
  { name: "Rahma Samir", score: 94, badge: "Presentation Glow-Up" },
  { name: "Youssef Adel", score: 93, badge: "Replay Master" },
];

export const badges = [
  {
    name: "Momentum",
    rule: "Attend four live classes in a row",
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Deep Focus",
    rule: "Complete replay notes for three sessions",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    name: "Courage",
    rule: "Join your first speaking or demo challenge",
    tone: "bg-orange-100 text-orange-700",
  },
  {
    name: "Builder",
    rule: "Ship a project or submit a polished assignment",
    tone: "bg-amber-100 text-amber-700",
  },
];

export const meetingRooms = [
  {
    name: "Classroom room",
    description:
      "Live lesson room with replay recording, moderated chat, likes, comments, and protected playback only inside the platform.",
    status: "Starts only during class time",
  },
  {
    name: "Private 1:1 room",
    description:
      "Teacher and student only, with private notes for both sides and follow-up actions tracked afterward.",
    status: "Teacher scheduled",
  },
  {
    name: "Leadership conference",
    description:
      "Admin, moderators, and teachers can coordinate hiring, incidents, or platform planning in one shared conference room.",
    status: "Role restricted",
  },
];

export const signupSteps = [
  "Learning goals and current level",
  "Study availability and preferred class times",
  "Career intent, strengths, and confidence areas",
  "Smart course recommendation and onboarding review",
];
