import React, { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';

/**
 * CareSetu Opaque Route Resolver Component
 * Intercepts /app/:opaqueId URLs, resolves them against backend server mapping,
 * and navigates to the destination route cleanly.
 */
export default function OpaqueRouteResolver() {
  const { opaqueId } = useParams<{ opaqueId: string }>();
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    async function resolveRoute() {
      if (!opaqueId) {
        if (isMounted) setError(true);
        return;
      }

      try {
        const response = await fetch(`/api/opaque-routes/resolve/${opaqueId}`, {
          headers: {
            'Accept': 'application/json',
          },
        });

        const json = await response.json();

        if (response.ok && json.success && json.data?.targetPath) {
          if (isMounted) {
            setResolvedPath(json.data.targetPath);
            setLoading(false);
          }
        } else {
          if (isMounted) {
            setError(true);
            setLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    resolveRoute();

    return () => {
      isMounted = false;
    };
  }, [opaqueId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Resolving secure route...</p>
        </div>
      </div>
    );
  }

  if (error || !resolvedPath) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={resolvedPath} replace />;
}
