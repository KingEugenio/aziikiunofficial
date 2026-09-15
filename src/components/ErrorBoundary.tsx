import React from "react";
import { WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { captureException } from "../lib/sentry";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Wraps the whole app (see App.tsx's root render). Before this existed,
 * there was no error boundary anywhere - any uncaught error during render,
 * in any component, anywhere, crashed React's entire tree with no fallback
 * UI at all. That's the exact "blank white screen, no explanation" failure
 * users hit when a component touched a value it assumed would always be
 * present (a missing customerId, a malformed items array on a legacy
 * record) and it wasn't.
 *
 * This does NOT fix the underlying bugs that cause a component to throw -
 * those still need fixing wherever they're found (see the defensive
 * guards added alongside this in InvoiceReceiptBuilder.tsx and money.ts).
 * What it does is make sure that if something unexpected still throws
 * somewhere no one has found yet, the person sees a real, recoverable
 * error screen with a way forward, instead of a blank tab that gives
 * neither the user nor a developer any idea what happened.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Logged to the browser console always; also reported to Sentry when
    // VITE_SENTRY_DSN is configured (see lib/sentry.ts) - either way this
    // is diagnosable rather than just "the app went blank" with no trace
    // of why.
    console.error("[ErrorBoundary] Caught a render error:", error, info.componentStack);
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Something went wrong</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                This part of Aziiki hit an unexpected error. Your data is safe - nothing was lost. Try again, and if it keeps happening, let us know what you were doing right before this appeared.
              </p>
              <p className="text-[10px] text-slate-400 mt-3 font-mono break-words bg-slate-50 border border-slate-200 rounded-lg p-2">
                {this.state.error.message}
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-1">
              <button
                onClick={this.handleReset}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
