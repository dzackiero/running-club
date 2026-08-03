import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { Connect } from "./pages/Connect";
import { Consent } from "./pages/Consent";
import { Goal } from "./pages/Goal";
import { Home } from "./pages/Home";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
          <Route path="/consent" element={<Consent />} />
          <Route element={<RequireAuth />}>
            <Route index element={<Home />} />
            <Route path="/goal" element={<Goal />} />
            <Route path="/connect" element={<Connect />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
