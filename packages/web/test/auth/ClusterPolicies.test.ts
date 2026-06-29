import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { Forbidden as ForbiddenCls } from "../../../domain/src/auth/Forbidden.js"
import { authorize, canView } from "../../app/auth/ClusterPolicies.js"

describe("ClusterPolicies", () => {
  describe("canView", () => {
    it("allows guest to view cluster overview", () => {
      expect(canView("guest", "cluster", "overview")).toBe(true)
    })

    it("allows guest to select environment", () => {
      expect(canView("guest", "cluster", "selectEnv")).toBe(true)
    })

    it("denies guest access to config settings", () => {
      expect(canView("guest", "config", "settings")).toBe(false)
    })

    it("denies readonly access to config settings", () => {
      expect(canView("readonly", "config", "settings")).toBe(false)
    })

    it("allows admin access to config settings", () => {
      expect(canView("admin", "config", "settings")).toBe(true)
    })

    it("allows all roles to view workflow list", () => {
      expect(canView("guest", "workflow", "list")).toBe(true)
      expect(canView("readonly", "workflow", "list")).toBe(true)
      expect(canView("user", "workflow", "list")).toBe(true)
      expect(canView("admin", "workflow", "list")).toBe(true)
    })
  })

  describe("authorize", () => {
    it("returns Forbidden for guest on config settings", async () => {
      const result = await Effect.runPromise(
        authorize("guest", "config", "settings").pipe(Effect.flip)
      )
      expect(result).toBeInstanceOf(ForbiddenCls)
      expect(result.entity).toBe("config")
      expect(result.action).toBe("settings")
    })

    it("returns void for admin on cluster overview", async () => {
      const result = await Effect.runPromise(
        authorize("admin", "cluster", "overview")
      )
      expect(result).toBeUndefined()
    })
  })
})
