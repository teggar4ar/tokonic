import { describe, expect, it } from "vitest";

import { isConfirmedStorageNotFound } from "../../src/server/storage/storage-absence";

describe("Storage absence classification", () => {
  it.each([
    [{ name: "StorageUnknownError", statusCode: "404" }],
    [{ name: "NotFound", statusCode: 404 }],
    [{ name: "StorageApiError", status: 404 }],
  ])("accepts only structured not-found errors", (error) => {
    expect(isConfirmedStorageNotFound(error)).toBe(true);
  });

  it.each([
    [undefined],
    [new Error("not found")],
    [{ name: "StorageApiError", statusCode: 401 }],
    [{ name: "StorageApiError", statusCode: 403 }],
    [{ name: "StorageApiError", statusCode: 500 }],
    [{ name: "NotFound" }],
    [{ name: "NotFound", statusCode: 401 }],
    [{ name: "NotFound", statusCode: 500 }],
    [{ name: "NetworkError" }],
  ])("rejects ambiguous, authorization, provider, and network failures", (error) => {
    expect(isConfirmedStorageNotFound(error)).toBe(false);
  });
});
