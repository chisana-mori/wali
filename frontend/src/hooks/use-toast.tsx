import * as React from "react";

type ToastActionElement = React.ReactElement<{
  altText: string;
}>;

type ToastProps = {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: "default" | "destructive";
};

type State = {
  toasts: ToastProps[];
};

type Action =
  | { type: "ADD"; toast: ToastProps }
  | { type: "DISMISS"; toastId?: string };

const ToastContext = React.createContext<{
  toasts: ToastProps[];
  toast: (toast: Omit<ToastProps, "id">) => string;
  dismiss: (toastId?: string) => void;
} | null>(null);

const TOAST_LIMIT = 5;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD": {
      const next = [action.toast, ...state.toasts].slice(0, TOAST_LIMIT);
      return { ...state, toasts: next };
    }
    case "DISMISS": {
      if (!action.toastId) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      };
    }
    default:
      return state;
  }
}

export function ToastProviderInternal(props: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, { toasts: [] });

  const toast = React.useCallback((input: Omit<ToastProps, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    dispatch({ type: "ADD", toast: { ...input, id } });
    return id;
  }, []);

  const dismiss = React.useCallback((toastId?: string) => {
    dispatch({ type: "DISMISS", toastId });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast, dismiss }}>
      {props.children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProviderInternal");
  }
  return ctx;
}
