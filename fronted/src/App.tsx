import { BrowserRouter, Route, Routes } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

import Users from "./pages/Users";
import CreateUser from "./pages/CreateUser";
import EditUser from "./pages/EditUser";

import Patients from "./pages/Patients";
import CreatePatient from "./pages/CreatePatient";
import EditPatient from "./pages/EditPatient";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/users" element={<Users />} />
        <Route path="/users/new" element={<CreateUser />} />
        <Route path="/users/:id/edit" element={<EditUser />} />

        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/new" element={<CreatePatient />} />
        <Route path="/patients/:id/edit" element={<EditPatient />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
