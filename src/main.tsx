import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getInitialTheme } from "@/lib/theme";

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

createRoot(document.getElementById("root")!).render(<App />);
