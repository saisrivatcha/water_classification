import React, { useState } from "react";
import Nav from "./Nav";
import WQIPage from "./WQIPage";
import ForecastPage from "./ForecastPage";
import AnomalyPage from "./AnomalyPage";
import ClassificationPage from "./ClassificationPage";
import "./global.css";

export default function App() {
  const [page, setPage] = useState("wqi");

  const pages = {
    wqi: <WQIPage />,
    forecast: <ForecastPage />,
    classification: <ClassificationPage />,
    anomaly: <AnomalyPage />,
  };

  return (
    <>
      <Nav page={page} setPage={setPage} />
      <div key={page} className="fade-up">
        {pages[page]}
      </div>
    </>
  );
}
