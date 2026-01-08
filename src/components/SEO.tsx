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

// Primary keywords targeting "AI patents" search intent
const PRIMARY_KEYWORDS = "AI patent, AI patents, AI patent application, machine learning patent, artificial intelligence patent, file AI patent, AI patent filing, AI patent software, patent AI tool, AI patent generator, AI patent drafting, deep learning patent, neural network patent, AI invention patent";
const SECONDARY_KEYWORDS = "USPTO filing, patent search, patent drafting, intellectual property protection, file patent online, patent application cost, patent attorney alternative, DIY patent, file patent without attorney, provisional patent, utility patent";

export const SEO = ({
  title,
  description = "File AI patent applications in minutes. AI-powered patent drafting for machine learning, neural networks & AI inventions. USPTO-ready formatting. $1,000 flat fee - save 90% vs attorneys.",
  keywords = `${PRIMARY_KEYWORDS}, ${SECONDARY_KEYWORDS}`,
  canonicalPath,
  noindex = false,
  ogType = "website",
  ogImage = DEFAULT_IMAGE,
  structuredData,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${BASE_TITLE}` : `${BASE_TITLE} - AI Patent Application Generator | File AI Patents for $1,000`;
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

// Pre-configured SEO for each page - optimized for "AI patents" ranking
export const PageSEO = {
  Home: () => (
    <SEO
      canonicalPath="/"
      description="File AI patents in minutes with PatentBot™. The #1 AI patent application tool for machine learning, neural networks & AI inventions. USPTO-ready formatting. $1,000 flat fee vs $10,000+ attorneys."
      keywords="AI patent, AI patents, file AI patent, AI patent application, machine learning patent, artificial intelligence patent, AI patent generator, AI patent software, neural network patent, deep learning patent, AI invention patent, USPTO AI patent, patent AI tool, AI patent drafting, file patent online, patent application cost, DIY patent application, file patent without attorney, patent attorney alternative, provisional patent, utility patent"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How to File an AI Patent Application",
        "description": "Step-by-step guide to filing a patent for AI, machine learning, or neural network inventions using PatentBot's AI-powered platform.",
        "totalTime": "PT30M",
        "estimatedCost": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": "1000"
        },
        "step": [
          {
            "@type": "HowToStep",
            "position": 1,
            "name": "Describe Your AI Invention",
            "text": "Answer AI-guided questions about your machine learning model, neural network architecture, or AI algorithm."
          },
          {
            "@type": "HowToStep",
            "position": 2,
            "name": "Prior Art Search",
            "text": "Our AI searches USPTO, Google Patents, and international databases to find similar AI patents and assess novelty."
          },
          {
            "@type": "HowToStep",
            "position": 3,
            "name": "AI Drafts Your Patent",
            "text": "PatentBot generates professional patent claims, detailed technical descriptions, and abstracts for your AI invention."
          },
          {
            "@type": "HowToStep",
            "position": 4,
            "name": "Review & Export",
            "text": "Review your USPTO-ready AI patent application and export to DOCX/PDF for filing."
          }
        ]
      }}
    />
  ),
  
  Pricing: () => (
    <SEO
      title="AI Patent Pricing - File AI Patents from $1,000"
      canonicalPath="/pricing"
      description="PatentBot™ AI patent pricing: $1,000 flat fee for complete USPTO-ready AI patent applications. File machine learning & neural network patents. $9.99/month for unlimited AI prior art searches."
      keywords="AI patent cost, AI patent application price, machine learning patent cost, file AI patent price, artificial intelligence patent filing cost, AI patent attorney alternative, how much does an AI patent cost, neural network patent price, deep learning patent cost, AI invention patent fees"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "PriceSpecification",
        "price": "1000",
        "priceCurrency": "USD",
        "description": "Complete AI patent application with USPTO-ready formatting for machine learning, neural networks, and AI inventions"
      }}
    />
  ),
  
  Demo: () => (
    <SEO
      title="AI Patent Demo - See AI Patent Drafting in Action"
      canonicalPath="/demo"
      description="Watch PatentBot™ transform your AI invention into a professional USPTO-ready patent application. Free demo shows how we draft AI patents, machine learning patents, and neural network patents in minutes."
      keywords="AI patent demo, machine learning patent demo, file AI patent demo, AI patent generator demo, neural network patent demo, AI patent drafting software, AI patent application tool, free AI patent demo"
    />
  ),
  
  Auth: () => (
    <SEO
      title="Sign In - Start Your AI Patent Application"
      canonicalPath="/auth"
      description="Sign in to PatentBot™ to file your AI patent application. Create a free account to file machine learning patents, neural network patents, and AI invention patents with AI-guided drafting."
      keywords="AI patent login, PatentBot sign in, file AI patent account, start AI patent application, machine learning patent account"
    />
  ),
  
  Check: () => (
    <SEO
      title="AI Patent Search - Check if Your AI Invention is Patentable"
      canonicalPath="/check"
      description="AI-powered prior art search for AI patents. Check if your machine learning model, neural network, or AI algorithm is patentable. Search USPTO & Google Patents for similar AI patents instantly."
      keywords="AI patent search, machine learning patent search, neural network patent search, AI prior art search, is my AI patentable, AI patent database search, artificial intelligence patent search, deep learning patent search, AI invention novelty check, AI patent similarity search, free AI patent search"
      structuredData={{
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "AI Patent Prior Art Search",
        "description": "AI-powered prior art search for machine learning patents, neural network patents, and AI inventions across USPTO, Google Patents, and international databases",
        "provider": {
          "@type": "Organization",
          "name": "PatentBot"
        },
        "offers": {
          "@type": "Offer",
          "price": "9.99",
          "priceCurrency": "USD",
          "description": "Unlimited AI patent searches per month"
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
  
  Profile: () => (
    <SEO
      title="Profile"
      noindex={true}
      description="View and edit your PatentBot™ profile."
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