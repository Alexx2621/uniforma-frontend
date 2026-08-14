import { clearSessionStorage } from "./clearSessionStorage";

describe("clearSessionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("conserva el dashboard por usuario y elimina los datos de sesion", () => {
    const dashboardKey = "uniforma:dashboard-widgets:v2:42";
    const dashboardPreferences = JSON.stringify({ version: 2, hidden: ["sales"] });

    window.localStorage.setItem(dashboardKey, dashboardPreferences);
    window.localStorage.setItem("uniforma-theme-mode", "dark");
    window.localStorage.setItem("token", "token-sensible");
    window.localStorage.setItem("permisos:v1", "[\"dashboard.view\"]");
    window.localStorage.setItem("uniforma:pedido-borrador", "contenido temporal");
    window.sessionStorage.setItem("dato-temporal", "contenido");

    clearSessionStorage();

    expect(window.localStorage.getItem(dashboardKey)).toBe(dashboardPreferences);
    expect(window.localStorage.getItem("uniforma-theme-mode")).toBe("dark");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("permisos:v1")).toBeNull();
    expect(window.localStorage.getItem("uniforma:pedido-borrador")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("conserva configuraciones independientes de varios usuarios", () => {
    window.localStorage.setItem("uniforma:dashboard-widgets:v2:42", "usuario-42");
    window.localStorage.setItem("uniforma:dashboard-widgets:v2:84", "usuario-84");

    clearSessionStorage();

    expect(window.localStorage.getItem("uniforma:dashboard-widgets:v2:42")).toBe("usuario-42");
    expect(window.localStorage.getItem("uniforma:dashboard-widgets:v2:84")).toBe("usuario-84");
  });
});
