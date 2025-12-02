import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { PageSEO } from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <PageSEO.NotFound />
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-gradient-primary rounded-2xl blur-xl opacity-20"></div>
            <div className="relative bg-card/80 backdrop-blur-sm rounded-2xl p-6">
              <img 
                src="https://i.ibb.co/wrhwtf5P/Patent-Bot-AI-Logo-Transparent.png" 
                alt="PatentBot AI Logo"
                className="h-16 w-auto mx-auto"
              />
            </div>
          </div>
        </div>
        
        <h1 className="text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
          404
        </h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="gradient" 
            asChild
          >
            <Link to="/">
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
