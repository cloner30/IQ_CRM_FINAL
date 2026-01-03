import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { GroupsList } from "./pages/GroupsList";
import { CreateGroup } from "./pages/CreateGroup";
import { GroupDetail } from "./pages/GroupDetail";
import { BulkUpload } from "./pages/BulkUpload";

function App() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsList />} />
            <Route path="/groups/new" element={<CreateGroup />} />
            <Route path="/groups/:groupId" element={<GroupDetail />} />
            <Route path="/groups/:groupId/upload" element={<BulkUpload />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </>
  );
}

export default App;
