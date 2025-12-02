import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  noindex?: boolean;
}

const BASE_TITLE = "PatentBot AI™";
const BASE_URL = "https://patentbot-ai.lovable.app";

export const SEO = ({
  title,
  description = "File patent applications in minutes with AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee.",
  keywords = "patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property, invention protection",
  canonicalPath,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI-Powered Patent Application Generator`;
  const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;
  const imageUrl = `${BASE_URL}/social-preview.png`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      )}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="PatentBot AI" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};

// Pre-configured SEO for each page
export const PageSEO = {
  Home: () => (
    <SEO
      canonicalPath="/"
      description="File patent applications in minutes with PatentBot AI™. AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee for complete applications. Start protecting your innovation today."
      keywords="patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, patent automation, file patent online, patent application cost"
    />
  ),
  
  Pricing: () => (
    <SEO
      title="Pricing"
      canonicalPath="/pricing"
      description="PatentBot AI pricing: $1,000 flat fee for complete patent applications, $9.99/month for unlimited prior art searches. No hidden fees. USPTO-ready formatting included."
      keywords="patent application cost, patent filing price, AI patent pricing, USPTO filing cost, affordable patent services, cheap patent filing, patent attorney alternative"
    />
  ),
  
  Demo: () => (
    <SEO
      title="Demo - See AI Patent Drafting in Action"
      canonicalPath="/demo"
      description="See PatentBot AI in action. Watch how AI transforms your invention ideas into professional USPTO-ready patent applications in minutes. Free demo available."
      keywords="patent AI demo, patent application demo, AI patent generator demo, USPTO filing demo, how to file patent"
    />
  ),
  
  Auth: () => (
    <SEO
      title="Sign In"
      canonicalPath="/auth"
      description="Sign in to PatentBot AI to start your patent application. Create an account to file patents with AI-guided drafting and prior art search."
      keywords="patent application login, PatentBot AI sign in, create patent account, file patent online"
    />
  ),
  
  Check: () => (
    <SEO
      title="Prior Art Search - Check Patent Novelty"
      canonicalPath="/check"
      description="Search existing patents to validate your invention's novelty before filing. PatentBot AI Check & See provides unlimited prior art searches for $9.99/month. Find similar patents instantly."
      keywords="prior art search, patent search, patent database search, invention novelty check, USPTO patent search, patent similarity search, free patent search, check if patent exists"
    />
  ),
  
  Dashboard: () => (
    <SEO
      title="Dashboard"
      noindex={true}
    />
  ),
  
  Ideas: () => (
    <SEO
      title="Ideas Lab"
      noindex={true}
    />
  ),
  
  NewApplication: () => (
    <SEO
      title="New Patent Application"
      noindex={true}
    />
  ),
  
  Session: () => (
    <SEO
      title="Patent Session"
      noindex={true}
    />
  ),
  
  Settings: () => (
    <SEO
      title="Settings"
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
