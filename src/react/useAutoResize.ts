import { useEffect, RefObject } from "react";
import { App } from "../app";

/**
 * React hook that automatically reports UI size changes to the host.
 *
 * Uses ResizeObserver to watch `document.body` and `document.documentElement` for
 * size changes and sends `ui/notifications/size-change` notifications.
 *
 * **Note**: This hook is rarely needed since the `useApp` hook automatically enables
 * auto-resize by default. This hook is provided for advanced cases where you
 * create the App manually with `autoResize: false` and want to add auto-resize
 * behavior later.
 *
 * @param app - The connected App instance, or null during initialization
 * @param elementRef - Reserved for future use. Currently unused; the hook always
 *   observes document.body and document.documentElement. Including this parameter
 *   will cause the effect to re-run when the ref changes, even though it has no effect.
 *
 * @example Manual App creation with custom auto-resize control
 * ```tsx
 * function MyComponent() {
 *   // For custom App options, create App manually instead of using useApp
 *   const [app, setApp] = useState<App | null>(null);
 *
 *   useEffect(() => {
 *     const myApp = new App(
 *       { name: "MyApp", version: "1.0.0" },
 *       {}, // capabilities
 *       { autoResize: false } // Disable default auto-resize
 *     );
 *
 *     const transport = new PostMessageTransport(window.parent);
 *     myApp.connect(transport).then(() => setApp(myApp));
 *   }, []);
 *
 *   // Add manual auto-resize control
 *   useAutoResize(app);
 *
 *   return <div>My content</div>;
 * }
 * ```
 *
 * @see {@link App.setupSizeChangeNotifications} for the underlying implementation
 * @see {@link useApp} which enables auto-resize by default
 */
export function useAutoResize(
  app: App | null,
  elementRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!app) {
      return;
    }

    return app.setupSizeChangeNotifications();
  }, [app, elementRef]);
}
