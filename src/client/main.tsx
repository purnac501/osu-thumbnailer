import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import { GeneratorPage } from "./GeneratorPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme appearance="dark" accentColor="gray" grayColor="gray" radius="small" scaling="100%">
      <GeneratorPage />
    </Theme>
  </StrictMode>,
);
