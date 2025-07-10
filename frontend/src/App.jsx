import { useState } from "react";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Contact from "./pages/Contact";
import Suggestions from "./pages/Suggestions";

function App() {
  const [page, setPage] = useState("home");

  const renderPage = () => {
    switch (page) {
      case "products": return <Products />;
      case "contact": return <Contact />;
      case "suggestions": return <Suggestions />;
      default: return <Home />;
    }
  };

  return (
    <div className="min-h-screen transition-all bg-white dark:bg-gray-900 text-black dark:text-white">
      <Navbar setPage={setPage} />
      <div className="p-4">{renderPage()}</div>
    </div>
  );
}

export default App;
