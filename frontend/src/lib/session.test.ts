import { afterEach, beforeEach, vi } from "vitest";

type SessionModule = typeof import("./session");

/** A browser lock shared by every "tab" (module copy) in the test, like navigator.locks across real tabs. */
function installSharedLock() {
  let tail: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, task: () => Promise<unknown>) => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  });
  Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
  return request;
}

const openTabs: SessionModule[] = [];

async function openTab(): Promise<SessionModule> {
  vi.resetModules();
  const tab = await import("./session");
  openTabs.push(tab);
  return tab;
}

const tokenResponse = (token: string) =>
  Response.json({ access_token: token, expires_in: 900 }, { status: 200 });

/** Lets queued BroadcastChannel messages arrive (they are delivered asynchronously). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("session", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    installSharedLock();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    // Stop every tab's refresh timer, so no test sees another test's requests.
    for (const tab of openTabs.splice(0)) tab.clearSession();
    await settle();
    vi.unstubAllGlobals();
  });

  it("keeps the access token only in memory (SC-006)", async () => {
    const tab = await openTab();
    tab.setSession("access-1", 900);
    expect(tab.getAccessToken()).toBe("access-1");
    expect(tab.isSignedIn()).toBe(true);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(Object.keys(globalThis).some((k) => k.includes("access-1"))).toBe(false);
  });

  it("treats an expired token as absent", async () => {
    const tab = await openTab();
    tab.setSession("access-1", 1);
    expect(tab.getAccessToken(Date.now() + 2000)).toBeNull();
  });

  it("never has two refresh requests in flight across tabs (research R4)", async () => {
    // The API ends every session when one refresh token is used twice. Requests that run one after
    // another are safe: the browser shares the cookie, so the second one carries the rotated token.
    const tabs = [await openTab(), await openTab(), await openTab()];
    let running = 0;
    let most = 0;
    let issued = 0;
    fetchMock.mockImplementation(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return tokenResponse(`fresh-${++issued}`);
    });

    const results = await Promise.all(tabs.map((tab) => tab.refresh()));
    await settle();

    expect(most).toBe(1);
    expect(results.every((r) => r?.startsWith("fresh-"))).toBe(true);
    for (const tab of tabs) expect(tab.getAccessToken()).toBe(`fresh-${issued}`);
  });

  it("reuses the token another tab has just shared instead of asking again", async () => {
    const tabA = await openTab();
    const tabB = await openTab();
    fetchMock.mockResolvedValue(tokenResponse("fresh"));

    expect(await tabA.refresh()).toBe("fresh");
    await settle(); // tab B has received the shared token
    expect(await tabB.refresh()).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one request between callers in the same tab", async () => {
    const tab = await openTab();
    fetchMock.mockResolvedValue(tokenResponse("fresh"));
    const results = await Promise.all([tab.refresh(), tab.refresh(), tab.refresh()]);
    expect(results).toEqual(["fresh", "fresh", "fresh"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/session/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
  });

  it("ends the session when the server refuses the refresh", async () => {
    const tab = await openTab();
    const seen: boolean[] = [];
    tab.subscribe((signedIn) => seen.push(signedIn));
    tab.setSession("old", 900);
    fetchMock.mockResolvedValue(Response.json({ error: { code: "invalid_token" } }, { status: 401 }));
    expect(await tab.refresh({ force: true })).toBeNull();
    expect(tab.getAccessToken()).toBeNull();
    expect(seen).toEqual([true, false]);
  });

  it("keeps the session when the server fails for another reason, or is unreachable", async () => {
    const tab = await openTab();
    tab.setSession("current", 900);
    expect(await tab.refresh()).toBe("current"); // still fresh: no request at all
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await tab.refresh({ force: true })).toBeNull();
    expect(tab.getAccessToken()).toBe("current");
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await tab.refresh({ force: true })).toBe("current");
  });

  it("logs out on the server and in every tab", async () => {
    const tabA = await openTab();
    const tabB = await openTab();
    tabA.setSession("shared", 900);
    await settle();
    expect(tabB.getAccessToken()).toBe("shared");

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await tabA.logout();
    await settle();
    expect(fetchMock).toHaveBeenCalledWith("/session/logout", { method: "POST", credentials: "same-origin" });
    expect(tabA.getAccessToken()).toBeNull();
    expect(tabB.getAccessToken()).toBeNull();
  });

  it("refreshes by itself a minute before the token ends", async () => {
    vi.useFakeTimers();
    try {
      const tab = await openTab();
      fetchMock.mockResolvedValue(tokenResponse("renewed"));
      tab.setSession("short", 120);
      await vi.advanceTimersByTimeAsync(59_000);
      expect(fetchMock).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      tab.clearSession();
    } finally {
      vi.useRealTimers();
    }
  });

  it("works without navigator.locks", async () => {
    Object.defineProperty(navigator, "locks", { value: undefined, configurable: true });
    const tab = await openTab();
    fetchMock.mockResolvedValue(tokenResponse("plain"));
    expect(await tab.refresh()).toBe("plain");
  });

  it("stops listening when unsubscribed", async () => {
    const tab = await openTab();
    const listener = vi.fn();
    const stop = tab.subscribe(listener);
    stop();
    tab.setSession("x", 900);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("ensureToken", () => {
  beforeEach(() => {
    installSharedLock();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("restores the session once per page load, then stays quiet for a signed-out visitor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); // no cookie: no session
    vi.stubGlobal("fetch", fetchMock);
    const tab = await openTab();
    expect(await tab.ensureToken()).toBeNull();
    expect(await tab.ensureToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores a signed-in visitor from the cookie, and refreshes an expired token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("restored"));
    vi.stubGlobal("fetch", fetchMock);
    const tab = await openTab();
    expect(await tab.ensureToken()).toBe("restored");
    expect(await tab.ensureToken()).toBe("restored");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 901_000);
      fetchMock.mockResolvedValue(tokenResponse("after-sleep"));
      expect(await tab.ensureToken()).toBe("after-sleep");
    } finally {
      vi.useRealTimers();
      tab.clearSession();
    }
  });
});
