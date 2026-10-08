import { Route, Routes } from "react-router-dom";
import { ABOUT, contactDoc, PRIVACY } from "./content/docs.js";
import { DocPage } from "./routes/DocPage.js";
import { Landing } from "./routes/Landing.js";
import { NotFound } from "./routes/NotFound.js";
import { Play } from "./routes/Play.js";
import { Table } from "./routes/Table.js";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/about" element={<DocPage doc={ABOUT} />} />
      <Route path="/contact" element={<DocPage doc={contactDoc()} />} />
      <Route path="/privacy" element={<DocPage doc={PRIVACY} />} />
      <Route path="/play" element={<Play />} />
      <Route path="/t/:code" element={<Table />} />
      <Route path="/watch/:code" element={<Table spectate />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
