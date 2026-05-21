import React from "react";
import { Route, Routes } from "react-router-dom";
import LoginLanding from "./LoginLanding";
import Dashboard from "./Dashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginLanding />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/doc/:docName" element={<Dashboard />} />
    </Routes>
  );
}
