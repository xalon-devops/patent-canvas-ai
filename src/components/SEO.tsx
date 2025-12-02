import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

const BASE_TITLE = "PatentBot AI™";
const BASE_URL = "https://patentbot.ai";

export const SEO = ({
  title,
  description = "File patent applications in minutes with AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee.",
  keywords = "patent application, AI patent generator, USPTO filing, patent search, patent drafting",
  canonicalPath,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI-Powered Patent Application Generator`;
  const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
};

// Pre-configured SEO for each page
export const PageSEO = {
  Home: () => (
    <SEO
      canonicalPath="/"
      description="File patent applications in minutes with PatentBot AI™. AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee. Start protecting your innovation today."
      keywords="patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, patent automation"
    />
  ),
  
  Pricing: () => (
    <SEO
      title="Pricing"
      canonicalPath="/pricing"
      description="PatentBot AI pricing: $1,000 flat fee for complete patent applications, $9.99/month for unlimited prior art searches. No hidden fees. USPTO-ready formatting included."
      keywords="patent application cost, patent filing price, AI patent pricing, USPTO filing cost, affordable patent services"
    />
  ),
  
  Demo: () => (
    <SEO
      title="Demo"
      canonicalPath="/demo"
      description="See PatentBot AI in action. Watch how AI transforms your invention ideas into professional USPTO-ready patent applications in minutes."
      keywords="patent AI demo, patent application demo, AI patent generator demo, USPTO filing demo"
    />
  ),
  
  Auth: () => (
    <SEO
      title="Sign In"
      canonicalPath="/auth"
      description="Sign in to PatentBot AI to start your patent application journey. Create an account to file patents with AI-guided drafting."
      keywords="patent application login, PatentBot AI sign in, create patent account"
    />
  ),
  
  Dashboard: () => (
    <SEO
      title="Dashboard"
      canonicalPath="/dashboard"
      description="Manage your patent applications, track progress, and access prior art searches from your PatentBot AI dashboard."
      noindex={true}
    />
  ),
  
  Check: () => (
    <SEO
      title="Prior Art Search"
      canonicalPath="/check"
      description="Search existing patents to validate your invention's novelty. PatentBot AI Check & See provides unlimited prior art searches for $9.99/month."
      keywords="prior art search, patent search, patent database search, invention novelty check, USPTO patent search"
    />
  ),
  
  Ideas: () => (
    <SEO
      title="Ideas Lab"
      canonicalPath="/ideas"
      description="Capture and develop your invention ideas in PatentBot AI's Ideas Lab. Track patentability and turn ideas into patent applications."
      noindex={true}
    />
  ),
  
  NewApplication: () => (
    <SEO
      title="New Patent Application"
      canonicalPath="/new-application"
      description="Start a new AI-guided patent application. Answer questions about your invention and receive a professionally drafted USPTO-ready patent."
      noindex={true}
    />
  ),
  
  Session: () => (
    <SEO
      title="Patent Session"
      noindex={true}
    />
  ),
  
  NotFound: () => (
    <SEO
      title="Page Not Found"
      noindex={true}
    />
  ),
};
