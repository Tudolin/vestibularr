import { ViewTransition } from "react";

/**
 * Template (remonta a cada navegação): a página que sai e a que entra animam com as classes "page"
 * (globals.css). O layout — topo, barras e o painel de estudo — persiste e fica parado.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
