import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./Layout";
import { NewGame } from "./pages/NewGame";
import { Season } from "./pages/Season";
import { Roster } from "./pages/Roster";
import { Rankings } from "./pages/Rankings";
import { Recruiting } from "./pages/Recruiting";
import { BudgetPage } from "./pages/Budget";
import { Offseason } from "./pages/Offseason";
import { useGame } from "../state/store";
import "./index.css";

function Guard({ children }: { children: React.ReactNode }) {
  const save = useGame((s) => s.save);
  return save ? <>{children}</> : <Navigate to="/" replace />;
}

function Root() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MenuOrGame />} />
        <Route element={<Layout />}>
          <Route path="/season" element={<Guard><Season /></Guard>} />
          <Route path="/roster" element={<Guard><Roster /></Guard>} />
          <Route path="/rankings" element={<Guard><Rankings /></Guard>} />
          <Route path="/recruiting" element={<Guard><Recruiting /></Guard>} />
          <Route path="/budget" element={<Guard><BudgetPage /></Guard>} />
          <Route path="/offseason" element={<Guard><Offseason /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

function MenuOrGame() {
  const save = useGame((s) => s.save);
  // On first load, offer to continue an autosave if one exists.
  return save ? <Navigate to={save.phase === "offseason" ? "/offseason" : "/season"} replace /> : <NewGame />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
