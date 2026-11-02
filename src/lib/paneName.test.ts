import { expect, it } from "bun:test";
import { folderName, placeLine, shortPathTitle, taskRowLines } from "./paneName.ts";

it("shows a path title as its last folder, and leaves any other title alone", () => {
  expect(shortPathTitle("/tmp/audit-oDjsU2/lms-backend")).toBe("lms-backend");
  expect(shortPathTitle("/home/haemin/dev/api/")).toBe("api");
  expect(shortPathTitle("~/dev/herdr web ui")).toBe("herdr web ui");
  expect(shortPathTitle("~")).toBe("~");
  expect(shortPathTitle("/")).toBe("/");
  expect(shortPathTitle("C:\\Users\\haemi\\work\\site")).toBe("site");
  expect(shortPathTitle("C:\\")).toBe("C:\\");
  expect(shortPathTitle("fix the login bug")).toBe("fix the login bug");
  expect(shortPathTitle("vim /etc/hosts")).toBe("vim /etc/hosts");
  expect(shortPathTitle("~tilde-name")).toBe("~tilde-name");
});

it("says a workspace and its folder once when they are the same", () => {
  expect(placeLine("lms-backend", "lms-backend")).toBe("lms-backend");
  expect(placeLine("api", "server")).toBe("api · server");
  expect(placeLine("api", "")).toBe("api");
});

it("finds the folder of a Windows path as of a POSIX one", () => {
  expect(folderName("C:\\work\\api")).toBe("api");
  expect(folderName("C:\\work\\api\\")).toBe("api");
  expect(folderName("C:/work/api")).toBe("api");
  expect(folderName("\\\\server\\share\\api")).toBe("api");
  expect(folderName("C:\\")).toBe("C:\\");
  expect(folderName("C:/")).toBe("C:/");
  expect(folderName("/home/haemin/dev/api/")).toBe("api");
  expect(folderName("/")).toBe("/");
  expect(folderName("/repo/branch ")).toBe("branch ");
  expect(placeLine("api", folderName("C:\\work\\api"))).toBe("api");
  expect(placeLine("api", folderName("C:\\work\\server"))).toBe("api · server");
});

it("draws a two-line row as the project over the pane's task and place, without repeating a name", () => {
  expect(taskRowLines({ paneTitle: "Idempotent payments", labelled: false, folder: "api", workspace: "checkout-api" }))
    .toEqual({ project: "checkout-api", task: "Idempotent payments · api" });
  // the folder is the workspace's name: it is said once
  expect(taskRowLines({ paneTitle: "Guard the export button", labelled: false, folder: "web-dashboard", workspace: "web-dashboard" }))
    .toEqual({ project: "web-dashboard", task: "Guard the export button" });
  // a shell titled by its folder says only the folder, when it is another name than the project's
  expect(taskRowLines({ paneTitle: "api", labelled: false, folder: "api", workspace: "checkout-api" }))
    .toEqual({ project: "checkout-api", task: "api" });
  expect(taskRowLines({ paneTitle: "release", labelled: false, folder: "release", workspace: "release" }))
    .toEqual({ project: "release", task: "" });
  // a pane the user named keeps its name, also when it is the folder's
  expect(taskRowLines({ paneTitle: "api", labelled: true, folder: "api", workspace: "checkout-api" }))
    .toEqual({ project: "checkout-api", task: "api" });
  // a linked worktree adds its branch where the project's name does not say it
  expect(taskRowLines({ paneTitle: "session-list", labelled: false, folder: "fix-session-list", workspace: "Hotfix", alias: "fix/session-list" }))
    .toEqual({ project: "Hotfix", task: "session-list · fix/session-list · fix-session-list" });
  // a pane named as its project does not have that name said again under it
  expect(taskRowLines({ paneTitle: "Hotfix", labelled: true, folder: "fix-payment", workspace: "Hotfix", alias: "fix/payment" }))
    .toEqual({ project: "Hotfix", task: "fix/payment · fix-payment" });
});
