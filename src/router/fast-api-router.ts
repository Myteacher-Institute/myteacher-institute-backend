import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Router as ExpressRouter } from 'express';
import Router from 'find-my-way';

export type ApiMount = { path: string; router: ExpressRouter };

// Express mount paths are case-insensitive and tolerate duplicate slashes;
// mirror that so the fast router agrees with the real Express matching.
const fw = (): ReturnType<typeof Router> => Router({ caseSensitive: false, ignoreDuplicateSlashes: true });

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const;

const joinPath = (base: string, tail: string): string => {
    const b = base.endsWith('/') ? base.slice(0, -1) : base;
    const t = tail.startsWith('/') ? tail : `/${tail}`;
    return `${b}${t}`;
};

const expressStackOf = (router: ExpressRouter): any[] => (router as any).stack ?? [];

/**
 * Replay an Express middleware/handler chain captured from a route. Each layer
 * is invoked with (req, res, next); errors are forwarded to the app-level
 * Express error handler. A matched-but-unanswered chain ends with a 404 rather
 * than falling through to Express, which would re-run the very same
 * controllers (double execution).
 */
const runExpressStack = (
    stack: RequestHandler[],
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    let index = 0;
    const dispatch = (err?: unknown): void => {
        const layer = stack[index++];
        if (!layer) {
            if (err) return next(err);
            if (!res.headersSent) {
                res.status(404).json({ status: 'failed', message: 'Route not handled' });
            }
            return;
        }
        try {
            layer(req, res, dispatch);
        } catch (error) {
            next(error);
        }
    };
    dispatch();
};

const isRouterLayer = (layer: any): boolean => !!layer && layer.name === 'router';

/**
 * Build a find-my-way (radix tree) router that mirrors every HTTP route
 * registered on the provided Express routers. Router-level middleware declared
 * with `router.use(...)` is hoisted onto each route of that router so auth and
 * limiter layers are preserved.
 *
 * Express stays the source of truth: paths the fast router cannot match fall
 * back to the regular routers, so no route is ever dropped.
 */
export const buildFastApiRouter = (mounts: ApiMount[]) => {
    const router = fw();

    for (const { path, router: expressRouter } of mounts) {
        const routerLevel: RequestHandler[] = [];

        for (const layer of expressStackOf(expressRouter)) {
            if (layer.route) {
                const routePath: unknown = layer.route.path;
                if (typeof routePath !== 'string') continue; // RegExp paths stay on Express

                const stack: RequestHandler[] = [
                    ...routerLevel,
                    ...(layer.route.stack as any[]).map((l: any) => l.handle),
                ];
                const fullPath = joinPath(path, routePath);
                const methods: string[] = Object.keys(layer.route.methods ?? {});

                for (const method of methods) {
                    const upper = method.toUpperCase();
                    if (!(HTTP_METHODS as readonly string[]).includes(upper)) continue;
                    try {
                        // The handler is matched via `find()` in the adapter below and
                        // never invoked directly; the real work reads the store, which
                        // is passed as the 5th arg (find-my-way drops other `opts`).
                        router.on(
                            upper as Router.HTTPMethod,
                            fullPath,
                            { constraints: {} },
                            () => {},
                            { stack }
                        );
                    } catch {
                        // Duplicate/conflicting registration — the Express router handles it.
                    }
                }
            } else if (typeof layer.handle === 'function' && !isRouterLayer(layer)) {
                routerLevel.push(layer.handle);
            }
            // Nested routers (layer.name === 'router') are left to Express.
        }
    }

    return (req: Request, res: Response, next: NextFunction): void => {
        const rawUrl = req.url ?? '/';
        const qIndex = rawUrl.indexOf('?');
        const pathname = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);

        let found: Router.FindResult<any> | null = null;
        try {
            found = router.find(req.method as Router.HTTPMethod, pathname);
        } catch {
            found = null;
        }
        if (!found) return next();

        req.params = { ...(req.params ?? {}), ...(found.params ?? {}) } as any;
        runExpressStack(
            (found.store as { stack: RequestHandler[] }).stack,
            req,
            res,
            next
        );
    };
};