import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  noindex?: boolean;
  ogType?: string;
}

const BASE_TITLE = "PatentBot AI™";
const BASE_URL = "https://patentbot-ai.com";
const SOCIAL_IMAGE = `${BASE_URL}/social-preview.png`;

export const SEO = ({
  title,
  description = "File patent applications in minutes with AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee. Save 90% vs patent attorneys.",
  keywords = "patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, invention patent, file patent online",
  canonicalPath,
  noindex = false,
  ogType = "website",
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI-Powered Patent Application Generator | $1,000 Flat Fee`;
  const canonicalUrl = canonicalPath ? `${BASE_URL}${canonicalPath}` : undefined;

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
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="PatentBot AI" />
      <meta property="og:image" content={SOCIAL_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="PatentBot AI - AI-Powered Patent Application Generator" />
      <meta property="og:locale" content="en_US" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={SOCIAL_IMAGE} />
      <meta name="twitter:image:alt" content="PatentBot AI - AI-Powered Patent Application Generator" />
    </Helmet>
  );
};

// Pre-configured SEO for each page - optimized for conversions and Google ranking
export const PageSEO = {
  Home: () => (
    <SEO
      canonicalPath="/"
      description="File patent applications in minutes with PatentBot AI™. AI-guided drafting, prior art search, and USPTO-ready formatting. Just $1,000 flat fee vs $10,000+ for attorneys. Protect your invention today."
      keywords="patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, patent automation, file patent online, patent application cost, cheap patent filing, patent attorney alternative, provisional patent application"
    />
  ),
  
  Pricing: () => (
    <SEO
      title="Pricing - Patent Applications from $1,000"
      canonicalPath="/pricing"
      description="PatentBot AI pricing: $1,000 flat fee for complete USPTO-ready patent applications. $9.99/month for unlimited prior art searches. Save 90% vs traditional patent attorneys. No hidden fees."
      keywords="patent application cost, patent filing price, AI patent pricing, USPTO filing cost, affordable patent services, cheap patent filing, patent attorney alternative, how much does a patent cost, patent application fees"
    />
  ),
  
  Demo: () => (
    <SEO
      title="Free Demo - See AI Patent Drafting in Action"
      canonicalPath="/demo"
      description="Watch PatentBot AI transform your invention idea into a professional USPTO-ready patent application in minutes. Free demo - see how our AI drafts claims, descriptions, and prior art analysis."
      keywords="patent AI demo, patent application demo, AI patent generator demo, USPTO filing demo, how to file patent, patent drafting software, patent application tool, free patent demo"
    />
  ),
  
  Auth: () => (
    <SEO
      title="Sign In - Start Your Patent Application"
      canonicalPath="/auth"
      description="Sign in to PatentBot AI to start your patent application. Create a free account to file patents with AI-guided drafting, prior art search, and professional formatting."
      keywords="patent application login, PatentBot AI sign in, create patent account, file patent online, start patent application"
    />
  ),
  
  Check: () => (
    <SEO
      title="Prior Art Search - Check if Your Invention is Patentable"
      canonicalPath="/check"
      description="Free prior art search to check if your invention is patentable. PatentBot AI searches USPTO, Google Patents & international databases. Unlimited searches for $9.99/month. Find similar patents instantly."
      keywords="prior art search, patent search, patent database search, invention novelty check, USPTO patent search, patent similarity search, free patent search, check if patent exists, is my invention patentable, patent novelty search, prior art analysis"
    />
  ),
  
  // Authenticated pages (noindex to prevent duplicate content)
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
  
  IdeaDetail: () => (
    <SEO
      title="Idea Details"
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
  
  Admin: () => (
    <SEO
      title="Admin Dashboard"
      noindex={true}
    />
  ),
  
  Drafts: () => (
    <SEO
      title="My Drafts"
      noindex={true}
    />
  ),
  
  Active: () => (
    <SEO
      title="Active Applications"
      noindex={true}
    />
  ),
  
  Pending: () => (
    <SEO
      title="Pending Applications"
      noindex={true}
    />
  ),
  
  Claims: () => (
    <SEO
      title="Patent Claims"
      noindex={true}
    />
  ),
  
  PaymentReturn: () => (
    <SEO
      title="Payment Complete"
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
