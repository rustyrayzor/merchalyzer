import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Workflow, Edit, Cog, Store, Wand2 } from 'lucide-react';
import WorkflowPage from './pages/WorkflowPage';
import EditPage from './pages/EditPage';
import SettingsPage from './pages/SettingsPage';
import PrintifyPage from './pages/PrintifyPage';
import DesignGeneratorPage from './pages/DesignGeneratorPage';
import { cn } from '@/lib/utils';

export type PageType = 'workflow' | 'edit' | 'settings' | 'printify' | 'designs';

interface NavigationItem {
  id: PageType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
}

const navigationItems: NavigationItem[] = [
  { id: 'workflow', label: 'Workflow', icon: Workflow, component: WorkflowPage },
  { id: 'designs', label: 'Design Generator', icon: Wand2, component: DesignGeneratorPage },
  { id: 'edit', label: 'Image Edit', icon: Edit, component: EditPage },
  { id: 'printify', label: 'Printify', icon: Store, component: PrintifyPage },
  { id: 'settings', label: 'Settings', icon: Cog, component: SettingsPage },
];

export default function Navigation() {
  const searchParams = useSearchParams();
  const [currentPage, setCurrentPage] = useState<PageType>('workflow');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Initialize page from URL query parameter and handle initial load
  useEffect(() => {
    const pageParam = searchParams.get('page') as PageType;
    if (pageParam && navigationItems.some(item => item.id === pageParam)) {
      setCurrentPage(pageParam);
    }

    // Trigger entrance animation after component mounts
    const timer = setTimeout(() => {
      setHasLoaded(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [searchParams]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const page = event.state?.page || 'workflow';
      setCurrentPage(page);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigation = (pageId: PageType) => {
    if (pageId === currentPage) return;

    // Start transition
    setIsTransitioning(true);

    // Small delay for smooth transition effect
    setTimeout(() => {
      setCurrentPage(pageId);

      // Update URL without page reload
      const newUrl = pageId === 'workflow' ? '/' : `/?page=${pageId}`;
      window.history.pushState({ page: pageId }, '', newUrl);

      // Scroll to top when changing pages
      window.scrollTo(0, 0);

      // End transition after content has updated
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 150);
  };

  const getPageTitle = (pageId: PageType): string => {
    switch (pageId) {
      case 'workflow':
        return 'Workflow';
      case 'designs':
        return 'Design Generator';
      case 'edit':
        return 'Image Edit';
      case 'printify':
        return 'Printify';
      case 'settings':
        return 'Settings';
      default:
        return 'Workflow';
    }
  };

  const CurrentPageComponent = navigationItems.find(item => item.id === currentPage)?.component || WorkflowPage;

  return (
    <div className={cn(
      "max-w-7xl mx-auto p-6 transition-all duration-500 ease-out",
      hasLoaded ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"
    )}>
      <h1 className={cn(
        "text-3xl font-bold mb-6 text-foreground transition-all duration-300 ease-in-out",
        isTransitioning ? "opacity-70 transform translate-y-1" : "opacity-100 transform translate-y-0"
      )}>
        {getPageTitle(currentPage)}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        <aside className="md:sticky md:top-4 h-fit">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start transition-all duration-200 ease-in-out",
                    "hover:scale-105 hover:shadow-sm active:scale-95",
                    isActive && "shadow-md"
                  )}
                  onClick={() => handleNavigation(item.id)}
                >
                  <Icon className={cn(
                    "h-4 w-4 mr-2 transition-all duration-200",
                    "group-hover:rotate-12"
                  )} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </aside>

        <div className={cn(
          "transition-all duration-300 ease-in-out",
          isTransitioning ? "opacity-0 transform translate-x-4" : "opacity-100 transform translate-x-0"
        )}>
          <CurrentPageComponent />
        </div>
      </div>
    </div>
  );
}
