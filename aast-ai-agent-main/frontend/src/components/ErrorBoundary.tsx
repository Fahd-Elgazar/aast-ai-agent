import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-700 px-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Something went wrong.</h1>
          <p className="max-w-md text-slate-500">
            The application hit an unexpected error and couldn't continue rendering this page. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-[rgb(20,41,82)] hover:bg-[rgb(30,55,100)] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
