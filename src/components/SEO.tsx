import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalPath?: string;
  noindex?: boolean;
  ogType?: string;
  ogImage?: string;
  structuredData?: object;
}

const BASE_TITLE = "PatentBot™";
const BASE_URL = "https://patentbot-ai.com";
const DEFAULT_IMAGE = `${BASE_URL}/social-preview.png`;

export const SEO = ({
  title,
  description = "File patent applications in minutes with AI-guided drafting, prior art search, and USPTO-ready formatting. $1,000 flat fee. Save 90% vs patent attorneys.",
  keywords = "patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, invention patent, file patent online",
  canonicalPath,
  noindex = false,
  ogType = "website",
  ogImage = DEFAULT_IMAGE,
  structuredData,
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
      <meta property="og:site_name" content="PatentBot™" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="PatentBot™ - AI-Powered Patent Application Generator" />
      <meta property="og:locale" content="en_US" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content="PatentBot™ - AI-Powered Patent Application Generator" />
      <meta name="twitter:site" content="@patentbotai" />
      
      {/* Page-specific structured data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
};

// Pre-configured SEO for each page - optimized for conversions and Google ranking
export const PageSEO = {
  Home: () => (
    <SEO
      canonicalPath="/"
      description="File patent applications in minutes with PatentBot™. AI-guided drafting, prior art search, and USPTO-ready formatting. Just $1,000 flat fee vs $10,000+ for attorneys. Protect your invention today."
      keywords="patent application, AI patent generator, USPTO filing, patent search, patent drafting, intellectual property protection, patent automation, file patent online, patent application cost, cheap patent filing, patent attorney alternative, provisional patent application, how to file a patent, utility patent, patent protection"
    />
  ),
  
  Pricing: () => (
    <SEO
      title="Pricing - Patent Applications from $1,000"
      canonicalPath="/pricing"
      description="PatentBot™ pricing: $1,000 flat fee for complete USPTO-ready patent applications. $9.99/month for unlimited prior art searches. Save 90% vs traditional patent attorneys. No hidden fees, no hourly billing."
      keywords="patent application cost, patent filing price, AI patent pricing, USPTO filing cost, affordable patent services, cheap patent filing, patent attorney alternative, how much does a patent cost, patent application fees, patent lawyer cost, provisional patent cost"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "PriceSpecification",
        "price": "1000",
        "priceCurrency": "USD",
        "description": "Complete AI-guided patent application with USPTO-ready formatting"
      }}
    />
  ),
  
  Demo: () => (
    <SEO
      title="Free Demo - See AI Patent Drafting in Action"
      canonicalPath="/demo"
      description="Watch PatentBot™ transform your invention idea into a professional USPTO-ready patent application in minutes. Free interactive demo - see how our AI drafts claims, descriptions, and conducts prior art analysis."
      keywords="patent AI demo, patent application demo, AI patent generator demo, USPTO filing demo, how to file patent, patent drafting software, patent application tool, free patent demo, patent writing software"
    />
  ),
  
  Auth: () => (
    <SEO
      title="Sign In - Start Your Patent Application"
      canonicalPath="/auth"
      description="Sign in to PatentBot™ to start your patent application. Create a free account to file patents with AI-guided drafting, prior art search, and professional USPTO formatting."
      keywords="patent application login, PatentBot sign in, create patent account, file patent online, start patent application, patent account"
    />
  ),
  
  Check: () => (
    <SEO
      title="Prior Art Search - Check if Your Invention is Patentable"
      canonicalPath="/check"
      description="AI-powered prior art search to check if your invention is patentable. PatentBot™ searches USPTO, Google Patents & international databases. 3 free searches, then unlimited for $9.99/month. Find similar patents instantly."
      keywords="prior art search, patent search, patent database search, invention novelty check, USPTO patent search, patent similarity search, free patent search, check if patent exists, is my invention patentable, patent novelty search, prior art analysis, patent clearance search, freedom to operate search"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Prior Art Search",
        "description": "AI-powered prior art search across USPTO, Google Patents, and international databases",
        "provider": {
          "@type": "Organization",
          "name": "PatentBot"
        },
        "offers": {
          "@type": "Offer",
          "price": "9.99",
          "priceCurrency": "USD",
          "description": "Unlimited prior art searches per month"
        }
      }}
    />
  ),
  
  // Authenticated pages (noindex to prevent duplicate content and protect user data)
  Dashboard: () => (
    <SEO
      title="Dashboard"
      noindex={true}
      description="Manage your patent applications, prior art searches, and invention ideas."
    />
  ),
  
  Ideas: () => (
    <SEO
      title="Ideas Lab"
      noindex={true}
      description="Track and develop your invention ideas with AI-powered monitoring."
    />
  ),
  
  IdeaDetail: () => (
    <SEO
      title="Idea Details"
      noindex={true}
      description="View and manage your invention idea details and prior art monitoring."
    />
  ),
  
  NewApplication: () => (
    <SEO
      title="New Patent Application"
      noindex={true}
      description="Start a new AI-guided patent application."
    />
  ),
  
  Session: () => (
    <SEO
      title="Patent Session"
      noindex={true}
      description="Continue your patent application session."
    />
  ),
  
  Settings: () => (
    <SEO
      title="Settings"
      noindex={true}
      description="Manage your PatentBot™ account settings."
    />
  ),
  
  Admin: () => (
    <SEO
      title="Admin Dashboard"
      noindex={true}
      description="PatentBot™ admin dashboard."
    />
  ),
  
  Drafts: () => (
    <SEO
      title="My Drafts"
      noindex={true}
      description="View and manage your patent application drafts."
    />
  ),
  
  Active: () => (
    <SEO
      title="Active Applications"
      noindex={true}
      description="Manage your active patent applications and portfolio."
    />
  ),
  
  Pending: () => (
    <SEO
      title="Pending Applications"
      noindex={true}
      description="Review your pending patent applications."
    />
  ),
  
  Claims: () => (
    <SEO
      title="Patent Claims"
      noindex={true}
      description="Review and refine your patent claims."
    />
  ),
  
  PaymentReturn: () => (
    <SEO
      title="Payment Complete"
      noindex={true}
      description="Payment confirmation for PatentBot™ services."
    />
  ),
  
  NotFound: () => (
    <SEO
      title="Page Not Found"
      noindex={true}
      description="The page you're looking for doesn't exist."
    />
  ),
};