import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { History } from "./pages/History";
import { Home } from "./pages/Home";
import { Metrics } from "./pages/Metrics";
import { Models } from "./pages/Models";
import { Plots } from "./pages/Plots";
import { Predict } from "./pages/Predict";
import { Result } from "./pages/Result";

/**
 * Root layout and client-side routes.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/predict" element={<Predict />} />
          <Route path="/plots" element={<Plots />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/models" element={<Models />} />
          <Route path="/history" element={<History />} />
          <Route path="/result/:id" element={<Result />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
