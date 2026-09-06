// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { oauthAuthorizationServerMetadata } from "../../convex/oauthConfig";

test.each(["oauth-authorization-server", "openid-configuration"])(
  "public %s advertises refresh tokens and matches the backend",
  (name) => {
    const metadata: unknown = JSON.parse(
      readFileSync(
        new URL(`../../public/.well-known/${name}`, import.meta.url),
        "utf8"
      )
    );

    expect(metadata).toMatchObject({
      grant_types_supported: ["authorization_code", "refresh_token"],
    });
    expect(metadata).toMatchObject(oauthAuthorizationServerMetadata);
  }
);
