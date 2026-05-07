import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { UserId } from "@template/domain/UserId"
import { Schema } from "effect"
import { RunsGroup } from "./RunsGroup.js"

export class HealthGroup extends HttpApiGroup.make("health")
  .add(
    HttpApiEndpoint.get("ping", "/ping").addSuccess(
      Schema.Struct({ ok: Schema.Boolean, user: Schema.optional(UserId) })
    )
  )
{}

export class Api extends HttpApi.make("api").add(HealthGroup).add(RunsGroup) {}
