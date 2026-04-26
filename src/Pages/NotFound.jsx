import { Link } from "react-router-dom";
import { PageHero, SiteLayout } from "../Components/SiteLayout";

export default function NotFound() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="404"
        title="That page does not exist yet."
        description="The route fell outside the regenerated app map, so this fallback keeps the experience clean instead of breaking."
        actions={
          <Link to="/" className="primary-btn">
            Back home
          </Link>
        }
      />
    </SiteLayout>
  );
}
