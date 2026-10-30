import React from 'react';
import { Home } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ROUTES } from '../../utils/constants';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('404 Page Not Found');

  return (
    <div className="not-found-container">
      <div className="not-found-code">404</div>
      <h2 className="not-found-title">Route Not Found</h2>
      <p className="not-found-description">
        The requested URL path does not exist in CodeSentinel AI. Check the path or navigate back to the home view.
      </p>
      <Button
        to={ROUTES.HOME}
        variant="primary"
        icon={<Home size={16} />}
      >
        Return to Home
      </Button>
    </div>
  );
}

export default NotFoundPage;
