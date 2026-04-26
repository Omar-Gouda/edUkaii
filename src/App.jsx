import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

const Home = lazy(() => import("./Pages/Home"));
const Courses = lazy(() => import("./Pages/Courses"));
const FrontendDev = lazy(() => import("./Pages/FrontendDev"));
const EnglishLang = lazy(() => import("./Pages/EnglishLang"));
const SimultaneousInterpretation = lazy(() => import("./Pages/SimultaneousInterpretation"));
const HRManagement = lazy(() => import("./Pages/HRManagement"));
const About = lazy(() => import("./Pages/About"));
const Community = lazy(() => import("./Pages/Blog"));
const Careers = lazy(() => import("./Pages/Careers"));
const Jobs = lazy(() => import("./Pages/Jobs"));
const ContactUs = lazy(() => import("./Pages/ContactUs"));
const SignUp = lazy(() => import("./Pages/SignUp"));
const SignIn = lazy(() => import("./Pages/SignIn"));
const ForgotPassword = lazy(() => import("./Pages/ForgotPassword"));
const ProfileSettings = lazy(() => import("./Pages/ProfileSettings"));
const AdminDashboard = lazy(() => import("./Pages/AdminDashboard"));
const AdminPanel = lazy(() => import("./Pages/AdminPanel"));
const MeetingsRooms = lazy(() => import("./Pages/MeetingsRooms"));
const OurInstructors = lazy(() => import("./Pages/OurInstructors"));
const InstructorsProfile = lazy(() => import("./Pages/InstructorsProfile"));
const Payments = lazy(() => import("./Pages/Payments"));
const NotFound = lazy(() => import("./Pages/NotFound"));
const PeopleProfile = lazy(() => import("./Pages/PeopleProfile"));
const CourseDetailPage = lazy(() => import("./Components/CourseDetailPage"));

function RouteFallback() {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-6">
      <div className="surface-card px-6 py-5 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-purple-700">Loading</p>
        <p className="mt-2 text-lg font-bold text-primary">Preparing your page...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:slug" element={<CourseDetailPage />} />
        <Route path="/courses/frontend" element={<FrontendDev />} />
        <Route path="/courses/english" element={<EnglishLang />} />
        <Route path="/courses/interpretation" element={<SimultaneousInterpretation />} />
        <Route path="/courses/hr" element={<HRManagement />} />
        <Route path="/teachers" element={<OurInstructors />} />
        <Route path="/teachers/:teacherId" element={<InstructorsProfile />} />
        <Route path="/about" element={<About />} />
        <Route path="/community" element={<Community />} />
        <Route path="/blog" element={<Navigate to="/community" replace />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/contact" element={<ContactUs />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/admin" element={<Navigate to="/admin-panel" replace />} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/meeting-rooms" element={<MeetingsRooms />} />
        <Route path="/people/:userId" element={<PeopleProfile />} />
        <Route path="/classroom" element={<Navigate to="/meeting-rooms#classrooms" replace />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
